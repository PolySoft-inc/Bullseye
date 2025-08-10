<script>
	import { onMount } from 'svelte';

	/* --- ElevenLabs (webrtc branch) --- */
	import { Button } from '$lib/components/ui/button/index.js';
	import { Conversation } from '@elevenlabs/client';
	import { PUBLIC_ELEVENLABS_API_KEY, PUBLIC_ELEVENLABS_AGENT_ID } from '$env/static/public';

	let conversation = null;
	let isConnected = false;
	let isSpeaking = false;
	let connectionStatus = 'disconnected';
	let sessionActive = false;
	let isAnalyzing = false;
	let frameCount = 0;

	// Add this new variable to track initialization state
	let isInitializing = false;

	// Add error throttling variables
	let errorCount = 0;
	let lastErrorTime = 0;
	const ERROR_THROTTLE_MS = 2000; // Only log errors every 2 seconds

	// Change from const to let for DEBUG
	let DEBUG = false; // Set to true for development, false for production

	// Add a logging utility function
	function logMessage(message, type = 'info') {
		if (DEBUG) {
			switch (type) {
				case 'error':
					console.error(message);
					break;
				case 'warn':
					console.warn(message);
					break;
				default:
					console.log(message);
			}
		}
	}

	async function initializeElevenLabs() {
		// Add initialization guard
		if (isInitializing || conversation) {
			logMessage('ElevenLabs already initializing or initialized');
			return;
		}

		logMessage('🚀 Starting ElevenLabs initialization...');
		isInitializing = true;

		try {
			// Try to get microphone (optional: if denied, still proceed)
			try {
				logMessage('🎤 Requesting microphone access...');
				await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}
				});
				logMessage('✅ Microphone access granted');
			} catch (error) {
				logMessage('⚠️ Microphone access denied, continuing without mic: ' + error.message);
			}

			logMessage('🔗 Starting ElevenLabs conversation...');
			conversation = await Conversation.startSession({
				agentId: PUBLIC_ELEVENLABS_AGENT_ID,
				connectionType: 'webrtc',
				onMessage: (message) => {
					logMessage('📨 Agent message: ' + JSON.stringify(message));
				},
				onError: (error) => {
					// Throttle error logging to prevent spam
					const now = Date.now();
					errorCount++;

					if (now - lastErrorTime > ERROR_THROTTLE_MS) {
						logMessage(`❌ ElevenLabs error #${errorCount}: ${error}`, 'error');
						lastErrorTime = now;
					}

					connectionStatus = 'error';
				},
				onClose: () => {
					logMessage('🔌 Connection closed');
					connectionStatus = 'disconnected';
					isConnected = false;
					isInitializing = false;
				},
				onOpen: () => {
					logMessage('✅ Connection opened successfully');
					connectionStatus = 'connected';
					isConnected = true;
					isInitializing = false;
					errorCount = 0;
				},
				onSpeaking: (speaking) => {
					logMessage('🗣️ Agent speaking: ' + speaking);
					isSpeaking = speaking;
				}
			});

			logMessage('🔊 Setting volume...');
			await conversation.setVolume({ volume: 0.7 });
			logMessage('✅ ElevenLabs initialization completed');

			// Add fallback: if onOpen doesn't trigger within 5 seconds, assume connected
			setTimeout(() => {
				if (conversation && !isConnected && isInitializing) {
					logMessage("⚠️ onOpen callback didn't trigger, assuming connected...");
					connectionStatus = 'connected';
					isConnected = true;
					isInitializing = false;
					logMessage('✅ Connection assumed successful via fallback');
				}
			}, 5000);
		} catch (error) {
			logMessage('❌ Error initializing ElevenLabs: ' + error, 'error');
			connectionStatus = 'error';
			isInitializing = false;
		}
	}

	async function startSession() {
		if (sessionActive || isInitializing) {
			logMessage('Session already active or initializing');
			return;
		}

		logMessage('🎯 Starting training session...');

		// Add a timeout for connection
		const connectionTimeout = setTimeout(() => {
			if (isInitializing) {
				logMessage('⏰ Connection timeout - taking too long to connect', 'error');
				isInitializing = false;
				connectionStatus = 'error';
			}
		}, 30000);

		await initializeElevenLabs();
		clearTimeout(connectionTimeout);

		sessionActive = true;
		isAnalyzing = true;
		frameCount = 0;
		logMessage('✅ Training session started');
	}

	async function stopSession() {
		if (!sessionActive) return;
		sessionActive = false;
		isAnalyzing = false;
		feedbackMessagesEnabled = false; // Disable feedback messages on stop

		// Stop message interval
		stopMessageInterval();

		if (conversation) {
			try {
				await conversation.endSession();
			} catch (e) {
				logMessage('Error ending ElevenLabs conversation: ' + e, 'error');
			}
			conversation = null;
			isConnected = false;
			connectionStatus = 'disconnected';
			isInitializing = false;
		}
	}

	async function resetSession() {
		await stopSession();
		frameCount = 0;
	}

	async function sendVoiceMessage() {
		if (conversation && isConnected) {
			// Add your voice input logic here if needed
			logMessage('Sending voice message to agent...');
		}
	}

	// Add this new function for coach notifications
	let lastFeedbackTime = 0;
	const FEEDBACK_THROTTLE_MS = 10000; // 5 seconds between feedback

	// Add interval-based messaging variables
	let messageInterval = null;
	let pendingFeedback = [];
	const MESSAGE_INTERVAL_MS = 30000; // 10 seconds between messages

	// Add a new reactive variable to track when we're actually sending
	let isNotifyingCoach = false;

	// Add feedback debouncing variables
	let feedbackDebounceTimer = null;
	let lastDebouncedFeedbackTime = 5000; // Renamed this variable
	const FEEDBACK_DEBOUNCE_MS = 10000; // 3 seconds delay before updating feedback

	// Add a new variable to control when feedback messages are enabled
	let feedbackMessagesEnabled = false;

	// Add a function to check if connection is truly ready
	function isConnectionReady() {
		return conversation && isConnected && sessionActive && !isInitializing;
	}

	async function notifyCoachOfFormCorrections(feedback) {
		// Check if feedback messages are enabled
		if (!feedbackMessagesEnabled) {
			logMessage('🔇 Feedback messages disabled - not sending to coach');
			return;
		}

		if (!isConnectionReady()) {
			logMessage('❌ Cannot notify coach - connection not ready');
			// Queue the feedback for later
			pendingFeedback.push(...feedback);
			return;
		}

		// Clear any existing debounce timer
		if (feedbackDebounceTimer) {
			clearTimeout(feedbackDebounceTimer);
		}

		// Debounce the feedback - only send after 3 seconds of no new feedback
		feedbackDebounceTimer = setTimeout(() => {
			const now = Date.now();
			if (now - lastDebouncedFeedbackTime > FEEDBACK_DEBOUNCE_MS) {
				// Use renamed variable
				logMessage('⏰ Debounced feedback ready to send:', feedback);

				// Add feedback to pending queue
				pendingFeedback.push(...feedback);
				lastDebouncedFeedbackTime = now; // Use renamed variable

				// Start interval if not already running
				if (!messageInterval) {
					startMessageInterval();
				}
			}
		}, FEEDBACK_DEBOUNCE_MS);
	}

	// Function to start the message interval
	function startMessageInterval() {
		if (messageInterval) {
			clearInterval(messageInterval);
		}

		messageInterval = setInterval(async () => {
			if (pendingFeedback.length > 0 && conversation && isConnected) {
				try {
					isNotifyingCoach = true;

					// Limit message size to avoid WebRTC limits
					const limitedFeedback = pendingFeedback.slice(0, 2); // Only send first 2 feedback items
					const message = `Coach, form corrections: ${limitedFeedback.join('. ')}`;

					// Ensure message isn't too long (keep under 1000 characters to be safe)
					const finalMessage = message.length > 1000 ? message.substring(0, 1000) + '...' : message;

					logMessage('💬 Sending message to coach: ' + finalMessage);

					// Try different methods based on SDK version
					if (typeof conversation.sendUserMessage === 'function') {
						await conversation.sendUserMessage(finalMessage);
					} else if (typeof conversation.sendMessage === 'function') {
						await conversation.sendMessage({ text: finalMessage });
					} else if (typeof conversation.send === 'function') {
						await conversation.send(finalMessage);
					} else {
						throw new Error('No valid send method found on conversation object');
					}

					logMessage('✅ Coach notified successfully');
					pendingFeedback = []; // Clear pending feedback
				} catch (error) {
					logMessage('❌ Error notifying coach: ' + error, 'error');
				} finally {
					isNotifyingCoach = false;
				}
			}
		}, MESSAGE_INTERVAL_MS);

		logMessage(`🔄 Started message interval (${MESSAGE_INTERVAL_MS}ms)`);
	}

	// Function to stop the message interval
	function stopMessageInterval() {
		if (messageInterval) {
			clearInterval(messageInterval);
			messageInterval = null;
			pendingFeedback = [];
			logMessage('🛑 Stopped message interval');
		}
	}

	/* --- Pose + 3D + Analysis (main branch) --- */
	import p5 from 'p5';
	import ml5 from 'ml5';
	import { Canvas } from '@threlte/core';
	import Pose3DScene from '$lib/components/Pose3DScene.svelte';
	import { analyzeArcheryForm, detectShotPhase } from '$lib/archery/formAnalysis.js';

	let p5Instance;
	let video;
	let bodyPose;
	let poses = [];
	let lerpPoints; // 2D smoothing
	let lerpPoints3D = []; // 3D smoothing

	let archeryAnalysis = null;
	let previousAnalysis = null;
	let shotPhase = 'idle';

	function sketch(p) {
		p.setup = async function () {
			p.createCanvas(640, 480);
			p.frameRate(30);

			bodyPose = await ml5.bodyPose('BlazePose', {
				modelComplexity: 1,
				smoothLandmarks: true,
				enableSegmentation: false,
				smoothSegmentation: false,
				minDetectionConfidence: 0.5,
				minTrackingConfidence: 0.5
			});

			video = p.createCapture(p.VIDEO);
			video.size(640, 480);
			video.hide();

			bodyPose.detectStart(video, gotPoses);
		};

		p.draw = function () {
			if (!video) return;

			p.image(video, 0, 0, p.width, p.height);

			if (poses.length > 0) {
				const pose = poses[0];

				// Initialize lerp points
				if (!lerpPoints) {
					lerpPoints = [];
					lerpPoints3D = [];
					for (let i = 0; i < pose.keypoints.length; i++) {
						lerpPoints[i] = p.createVector(pose.keypoints[i].x, pose.keypoints[i].y);
						if (pose.keypoints3D && pose.keypoints3D[i]) {
							lerpPoints3D[i] = {
								x: pose.keypoints3D[i].x,
								y: pose.keypoints3D[i].y,
								z: pose.keypoints3D[i].z
							};
						} else {
							const normalizedX = (pose.keypoints[i].x - 320) / 320;
							const normalizedY = (pose.keypoints[i].y - 240) / 240;
							lerpPoints3D[i] = { x: normalizedX, y: -normalizedY, z: 0 };
						}
					}
				}

				// Interpolate and draw
				for (let i = 0; i < pose.keypoints.length; i++) {
					const keypoint = pose.keypoints[i];
					const lp2 = lerpPoints[i];
					const lp3 = lerpPoints3D[i];
					const amt = 0.3;

					if (keypoint.confidence > 0.3) {
						lp2.x = p.lerp(lp2.x, keypoint.x, amt);
						lp2.y = p.lerp(lp2.y, keypoint.y, amt);

						if (pose.keypoints3D && pose.keypoints3D[i]) {
							const kp3D = pose.keypoints3D[i];
							lp3.x = p.lerp(lp3.x, kp3D.x, amt);
							lp3.y = p.lerp(lp3.y, kp3D.y, amt);
							lp3.z = p.lerp(lp3.z, kp3D.z, amt);
						} else {
							const nx = (keypoint.x - 320) / 320;
							const ny = (keypoint.y - 240) / 240;
							lp3.x = p.lerp(lp3.x, nx, amt);
							lp3.y = p.lerp(lp3.y, -ny, amt);
							lp3.z = p.lerp(lp3.z, 0, amt);
						}

						p.fill(0, 255, 0);
						p.noStroke();
						p.circle(lp2.x, lp2.y, 10);
					}
				}

				// Svelte reactivity for 3D points
				lerpPoints3D = [...lerpPoints3D];

				// Analysis
				if (pose.keypoints && pose.keypoints.length >= 25) {
					previousAnalysis = archeryAnalysis;
					archeryAnalysis = analyzeArcheryForm(pose.keypoints);
					if (archeryAnalysis && previousAnalysis) {
						shotPhase = detectShotPhase(archeryAnalysis, previousAnalysis);
					}

					// Add better logging here
					if (archeryAnalysis && archeryAnalysis.feedback && archeryAnalysis.feedback.length > 0) {
						logMessage('🎯 Form feedback detected:', archeryAnalysis.feedback);

						// Only send if connection is ready
						if (isConnectionReady()) {
							notifyCoachOfFormCorrections(archeryAnalysis.feedback);
						} else {
							// Queue for later
							pendingFeedback.push(...archeryAnalysis.feedback);
						}
					}
				}

				// Count frames only when analyzing and we have a pose
				if (isAnalyzing) frameCount++;
			}
		};
	}

	function gotPoses(results) {
		poses = results;
		// optional: light debug for 3D availability
		if (poses.length > 0 && Math.random() < 0.1) {
			const pose = poses[0];
		}
	}

	onMount(() => {
		const container = document.getElementById('p5-container');
		p5Instance = new p5(sketch, container);

		setTimeout(() => {
			const canvas = container.querySelector('canvas');
			if (canvas) {
				canvas.style.maxWidth = '100%';
				canvas.style.height = 'auto';
			}
		}, 100);

		return async () => {
			if (p5Instance) p5Instance.remove();
			if (conversation) {
				try {
					await conversation.endSession();
				} catch (e) {
					logMessage('Cleanup endSession error:', e);
				}
			}
		};
	});

	// Add this function for testing
	async function testCoachMessage() {
		if (conversation && isConnected) {
			try {
				logMessage('🧪 Testing coach message...');
				await conversation.sendUserMessage('Test message from archery training system');
				logMessage('✅ Test message sent successfully');

				// Enable feedback messages after successful test
				feedbackMessagesEnabled = true;
				logMessage('✅ Feedback messages now enabled');
			} catch (error) {
				logMessage('❌ Test message failed: ' + error, 'error');
			}
		} else {
			logMessage('❌ Cannot send test - not connected');
		}
	}

	// Add this function for manual reset
	async function forceReset() {
		logMessage('🔄 Force resetting all states...');
		isInitializing = false;
		isConnected = false;
		sessionActive = false;
		isAnalyzing = false;
		connectionStatus = 'disconnected';
		feedbackMessagesEnabled = false; // Disable feedback messages on reset

		// Clear feedback debounce timer
		if (feedbackDebounceTimer) {
			clearTimeout(feedbackDebounceTimer);
			feedbackDebounceTimer = null;
		}

		if (conversation) {
			try {
				await conversation.endSession();
			} catch (e) {
				logMessage('Error ending conversation during force reset:', e);
			}
			conversation = null;
		}

		logMessage('✅ Force reset completed');
	}

	// Add this function to manually check connection status
	async function checkConnectionStatus() {
		logMessage('🔍 Checking connection status...');
		logMessage('Current state:', {
			conversation: !!conversation,
			isConnected,
			isInitializing,
			connectionStatus
		});

		if (conversation && !isConnected && isInitializing) {
			logMessage('⚠️ Connection seems stuck, forcing connected state...');
			connectionStatus = 'connected';
			isConnected = true;
			isInitializing = false;
			logMessage('✅ Connection state manually corrected');
		}
	}

	// Add this function to debug the conversation object
	function debugConversationObject() {
		if (conversation) {
			logMessage('🔍 Conversation object methods:', Object.getOwnPropertyNames(conversation));
			logMessage('🔍 Conversation object:', conversation);
		} else {
			logMessage('❌ No conversation object available');
		}
	}

	// UI State
	let showDebugPanel = false;
	let showAnalysis = false;
</script>

<!-- Remove the min-h-screen and fix the background -->
<div class="h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black">
	<!-- Mobile Header -->
	<header class="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/95 p-4 backdrop-blur-lg">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-white">Archery Training</h1>

			<!-- Connection Status -->
			<div class="flex items-center gap-2">
				<div
					class="h-2 w-2 rounded-full {isConnected
						? 'bg-green-500'
						: isInitializing
							? 'bg-yellow-500'
							: 'bg-red-500'}"
				></div>
				<span class="text-xs text-gray-300">
					{#if isInitializing}
						Connecting...
					{:else}
						{isConnected ? 'Connected' : 'Offline'}
					{/if}
				</span>
			</div>
		</div>
	</header>

	<!-- Main Content - Add proper height and overflow -->
	<div class="h-[calc(100vh-80px)] overflow-y-auto">
		<div class="space-y-4 p-4">
			<!-- Session Controls - Mobile Optimized -->
			<div class="space-y-3">
				{#if !sessionActive && !isInitializing}
					<Button
						onclick={startSession}
						class="w-full bg-green-600 py-4 text-lg hover:bg-green-700"
					>
						🎯 Start Training Session
					</Button>
				{:else if isInitializing}
					<Button disabled class="w-full bg-yellow-600 py-4 text-lg opacity-50">
						⏳ Connecting to Coach...
					</Button>
				{:else}
					<Button onclick={stopSession} class="w-full bg-red-600 py-3 hover:bg-red-700">
						⏹️ Stop Training
					</Button>

					<Button
						onclick={testCoachMessage}
						variant="outline"
						class="w-full bg-blue-600 py-3 hover:bg-blue-700"
					>
						🎯 Start Shooting
					</Button>
				{/if}
			</div>

			<!-- Quick Stats Cards - Mobile Grid -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				<div class="rounded-lg bg-gray-800/50 p-3 text-center">
					<div class="text-xs text-gray-400">Analyzing</div>
					<div class="text-lg font-bold {isAnalyzing ? 'text-green-400' : 'text-gray-400'}">
						{isAnalyzing ? 'Yes' : 'No'}
					</div>
				</div>
				{#if isConnected}
					<div class="rounded-lg bg-gray-800/50 p-3 text-center">
						<div class="text-xs text-gray-400">Speaking</div>
						<div class="text-lg font-bold {isSpeaking ? 'text-blue-400' : 'text-gray-400'}">
							{isSpeaking ? 'Yes' : 'No'}
						</div>
					</div>
				{/if}
				{#if archeryAnalysis}
					<div class="rounded-lg bg-gray-800/50 p-3 text-center">
						<div class="text-xs text-gray-400">Score</div>
						<div class="text-lg font-bold text-green-400">
							{archeryAnalysis.overallScore.toFixed(0)}%
						</div>
					</div>
				{/if}
			</div>

			<!-- Camera Views - Mobile Stacked -->
			<div class="space-y-4">
				<!-- 2D Pose View -->
				<div class="space-y-2">
					<h2 class="text-lg font-semibold text-white">Live Camera Feed</h2>
					<div
						id="p5-container"
						class="aspect-video w-full overflow-hidden rounded-xl border-2 border-blue-500 bg-gray-900 shadow-lg"
					></div>
				</div>

				<!-- 3D Pose View -->
				<div class="space-y-2">
					<h2 class="text-lg font-semibold text-white">3D Pose Analysis</h2>
					<div
						class="aspect-square w-full overflow-hidden rounded-xl border-2 border-purple-500 bg-gray-900 shadow-lg"
					>
						<Canvas>
							<Pose3DScene {poses} {lerpPoints3D} />
						</Canvas>
					</div>
				</div>
			</div>

			<!-- Form Analysis - Collapsible on Mobile -->
			{#if archeryAnalysis}
				<div class="space-y-4">
					<!-- Analysis Toggle -->
					<button
						onclick={() => (showAnalysis = !showAnalysis)}
						class="flex w-full items-center justify-between rounded-lg bg-gray-800/50 p-4 text-left transition-colors hover:bg-gray-800/70"
					>
						<div>
							<h3 class="text-lg font-semibold text-white">Form Analysis</h3>
							<div class="text-sm text-gray-400">
								Score: {archeryAnalysis.overallScore.toFixed(0)}% | Phase: {shotPhase.replace(
									'_',
									' '
								)}
							</div>
						</div>
						<div class="text-gray-400">
							{showAnalysis ? '▼' : '▶'}
						</div>
					</button>

					{#if showAnalysis}
						<div class="space-y-4 rounded-lg bg-gray-800/30 p-4">
							<!-- Overall Score and Phase -->
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<div class="rounded-lg bg-gray-700/50 p-3 text-center">
									<h4 class="text-xs text-gray-300">Overall Score</h4>
									<div
										class="text-2xl font-bold {archeryAnalysis.overallScore >= 80
											? 'text-green-400'
											: archeryAnalysis.overallScore >= 60
												? 'text-yellow-400'
												: 'text-red-400'}"
									>
										{archeryAnalysis.overallScore.toFixed(0)}%
									</div>
								</div>
								<div class="rounded-lg bg-gray-700/50 p-3 text-center">
									<h4 class="text-xs text-gray-300">Shot Phase</h4>
									<div class="text-lg font-semibold text-blue-400 capitalize">
										{shotPhase.replace('_', ' ')}
									</div>
								</div>
								<div class="rounded-lg bg-gray-700/50 p-3 text-center">
									<h4 class="text-xs text-gray-300">Hand</h4>
									<div class="text-lg font-semibold text-purple-400 capitalize">
										{archeryAnalysis.dominantHand}
									</div>
								</div>
							</div>

							<!-- Scores Breakdown -->
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
								{#each Object.entries(archeryAnalysis.scores) as [metric, score]}
									<div class="rounded-lg bg-gray-700/30 p-2">
										<h5 class="mb-1 text-xs text-gray-400 capitalize">
											{metric.replace(/([A-Z])/g, ' $1').toLowerCase()}
										</h5>
										<div class="flex items-center justify-between">
											<span
												class="text-sm font-medium {score >= 80
													? 'text-green-400'
													: score >= 60
														? 'text-yellow-400'
														: 'text-red-400'}"
											>
												{score.toFixed(0)}%
											</span>
											<div class="h-1.5 w-8 overflow-hidden rounded-full bg-gray-600">
												<div
													class="h-full transition-all duration-300 {score >= 80
														? 'bg-green-400'
														: score >= 60
															? 'bg-yellow-400'
															: 'bg-red-400'}"
													style="width: {score}%"
												></div>
											</div>
										</div>
									</div>
								{/each}
							</div>

							<!-- Real-time Feedback -->
							{#if archeryAnalysis.feedback.length > 0}
								<div class="rounded-lg border border-orange-600/50 bg-orange-900/30 p-3">
									<h4 class="mb-2 font-semibold text-orange-300">Form Corrections:</h4>
									<div class="space-y-1">
										{#each archeryAnalysis.feedback as feedback}
											<div class="flex items-start gap-2 text-sm text-orange-200">
												<span class="mt-0.5 text-orange-400">•</span>
												<span>{feedback}</span>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<div class="rounded-lg border border-green-600/50 bg-green-900/30 p-3">
									<h4 class="font-semibold text-green-300">✅ Excellent Form!</h4>
									<p class="text-sm text-green-200">Your archery form looks great. Keep it up!</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Debug Panel - Collapsible -->
			<div class="space-y-2">
				<button
					onclick={() => (showDebugPanel = !showDebugPanel)}
					class="flex w-full items-center justify-between rounded-lg bg-gray-800/50 p-3 text-left transition-colors hover:bg-gray-800/70"
				>
					<span class="text-sm font-medium text-gray-300">Debug Info</span>
					<span class="text-gray-400">{showDebugPanel ? '▼' : '▶'}</span>
				</button>

				{#if showDebugPanel}
					<div class="rounded-lg bg-gray-800/30 p-3">
						<div class="grid grid-cols-2 gap-2 text-xs text-gray-400 sm:grid-cols-3">
							<div>Session: {sessionActive ? 'Active' : 'Inactive'}</div>
							<div>Connected: {isConnected ? 'Yes' : 'No'}</div>
							<div>Analyzing: {isAnalyzing ? 'Yes' : 'No'}</div>
							<div>Speaking: {isSpeaking ? 'Yes' : 'No'}</div>
							<div>Errors: {errorCount}</div>
							<div>Pending: {pendingFeedback.length}</div>
						</div>

						<!-- Debug Actions -->
						<div class="mt-3 flex flex-wrap gap-2">
							<Button onclick={forceReset} variant="outline" size="sm" class="text-xs">
								Force Reset
							</Button>
							<Button
								onclick={() => (DEBUG = !DEBUG)}
								variant="outline"
								size="sm"
								class="text-xs {DEBUG ? 'bg-purple-600' : ''}"
							>
								Debug: {DEBUG ? 'ON' : 'OFF'}
							</Button>
							{#if conversation && !isConnected}
								<Button onclick={checkConnectionStatus} variant="outline" size="sm" class="text-xs">
									Fix Connection
								</Button>
							{/if}
							{#if conversation}
								<Button
									onclick={debugConversationObject}
									variant="outline"
									size="sm"
									class="text-xs"
								>
									Debug Conv
								</Button>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Status Indicators -->
			{#if isNotifyingCoach}
				<div class="flex items-center justify-center gap-2 rounded-lg bg-orange-900/30 p-3">
					<div class="h-2 w-2 animate-pulse rounded-full bg-orange-500"></div>
					<span class="text-sm text-orange-300">Sending feedback to coach...</span>
				</div>
			{/if}
		</div>
	</div>
</div>
