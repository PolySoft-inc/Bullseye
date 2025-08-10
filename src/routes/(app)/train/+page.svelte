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

	async function initializeElevenLabs() {
		try {
			// Try to get microphone (optional: if denied, still proceed)
			try {
				await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}
				});
			} catch (_) {
				/* ignore mic errors; agent can still connect */
			}

			conversation = await Conversation.startSession({
				agentId: PUBLIC_ELEVENLABS_AGENT_ID,
				connectionType: 'webrtc',
				onMessage: (message) => {
					console.log('Agent message:', message);
				},
				onError: (error) => {
					console.error('ElevenLabs error:', error);
					connectionStatus = 'error';
				},
				onClose: () => {
					connectionStatus = 'disconnected';
					isConnected = false;
				},
				onOpen: () => {
					connectionStatus = 'connected';
					isConnected = true;
				},
				onSpeaking: (speaking) => {
					isSpeaking = speaking;
				}
			});

			await conversation.setVolume({ volume: 0.7 });
		} catch (error) {
			console.error('Error initializing ElevenLabs:', error);
			connectionStatus = 'error';
		}
	}

	async function startSession() {
		if (sessionActive) return;
		await initializeElevenLabs();
		sessionActive = true;
		isAnalyzing = true;
		frameCount = 0;
	}

	async function stopSession() {
		if (!sessionActive) return;
		sessionActive = false;
		isAnalyzing = false;

		if (conversation) {
			try {
				await conversation.endSession();
			} catch (e) {
				console.error('Error ending ElevenLabs conversation:', e);
			}
			conversation = null;
			isConnected = false;
			connectionStatus = 'disconnected';
		}
	}

	async function resetSession() {
		await stopSession();
		frameCount = 0;
	}

	async function sendVoiceMessage() {
		if (conversation && isConnected) {
			// Add your voice input logic here if needed
			console.log('Sending voice message to agent...');
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
				}

				// Count frames only when analyzing and we have a pose
				if (isAnalyzing) frameCount++;

				// Occasional debug
				if (p.frameCount % 60 === 0 && archeryAnalysis) {
					console.log('Archery Analysis:', {
						overallScore: archeryAnalysis.overallScore.toFixed(1),
						phase: shotPhase,
						dominantHand: archeryAnalysis.dominantHand,
						feedback: archeryAnalysis.feedback
					});
				}
			}
		};
	}

	function gotPoses(results) {
		poses = results;
		// optional: light debug for 3D availability
		if (poses.length > 0 && Math.random() < 0.1) {
			const pose = poses[0];
			if (pose.keypoints3D?.[0]) {
				console.log(
					'3D nose:',
					pose.keypoints3D[0].x.toFixed(3),
					pose.keypoints3D[0].y.toFixed(3),
					pose.keypoints3D[0].z.toFixed(3)
				);
			}
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
					console.error('Cleanup endSession error:', e);
				}
			}
		};
	});
</script>

<div class="h-full overflow-y-scroll bg-gradient-to-br from-gray-900 to-black pt-6 lg:flex-row">
	<div class="flex flex-1 flex-col items-center justify-center p-4">
		<!-- Session Controls -->
		<div class="mb-6 flex gap-4">
			{#if !sessionActive}
				<Button onclick={startSession} class="bg-green-600 px-8 py-3 text-lg hover:bg-green-700">
					Start Training
				</Button>
			{:else}
				<Button onclick={stopSession} class="bg-red-600 px-6 py-3 hover:bg-red-700">Stop</Button>
				<Button onclick={resetSession} variant="outline" class="px-6 py-3">Reset</Button>
			{/if}
		</div>

		<!-- Status Row -->
		<div class="mb-8 flex items-center justify-center gap-6 text-sm text-gray-300">
			<div class="flex items-center gap-2">
				<div class="h-2 w-2 rounded-full {isConnected ? 'bg-green-500' : 'bg-gray-500'}"></div>
				<span>Voice coach {isConnected ? 'connected' : 'disconnected'}</span>
			</div>
			<div>Analyzing: {isAnalyzing ? 'yes' : 'no'}</div>
			<div>Frames: {frameCount}</div>
			{#if isConnected}
				<div>Agent speaking: {isSpeaking ? 'yes' : 'no'}</div>
			{/if}
		</div>

		<!-- Views -->
		<div class="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- 2D Pose View -->
			<div class="flex flex-col items-center">
				<h2 class="mb-4 text-xl text-white">2D Pose Detection</h2>
				<div
					id="p5-container"
					class="max-w-full overflow-hidden rounded-xl border-2 border-blue-500 shadow-2xl"
				></div>
			</div>

			<!-- 3D Pose View -->
			<div class="flex flex-col items-center">
				<h2 class="mb-4 text-xl text-white">3D Pose Visualization</h2>
				<div
					class="aspect-square w-full max-w-lg overflow-hidden rounded-xl border-2 border-purple-500 shadow-2xl"
				>
					<Canvas>
						<Pose3DScene {poses} {lerpPoints3D} />
					</Canvas>
				</div>
			</div>
		</div>

		<!-- Archery Form Analysis Panel -->
		{#if archeryAnalysis}
			<div class="mt-8 w-full max-w-4xl">
				<div class="rounded-xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-lg">
					<h3 class="mb-4 text-2xl font-bold text-white">Archery Form Analysis</h3>

					<!-- Overall Score and Phase -->
					<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
						<div class="rounded-lg bg-gray-700/50 p-4">
							<h4 class="mb-1 text-sm text-gray-300">Overall Form Score</h4>
							<div
								class="text-3xl font-bold {archeryAnalysis.overallScore >= 80
									? 'text-green-400'
									: archeryAnalysis.overallScore >= 60
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{archeryAnalysis.overallScore.toFixed(0)}%
							</div>
						</div>
						<div class="rounded-lg bg-gray-700/50 p-4">
							<h4 class="mb-1 text-sm text-gray-300">Shot Phase</h4>
							<div class="text-xl font-semibold text-blue-400 capitalize">
								{shotPhase.replace('_', ' ')}
							</div>
						</div>
						<div class="rounded-lg bg-gray-700/50 p-4">
							<h4 class="mb-1 text-sm text-gray-300">Dominant Hand</h4>
							<div class="text-xl font-semibold text-purple-400 capitalize">
								{archeryAnalysis.dominantHand}
							</div>
						</div>
					</div>

					<!-- Scores Breakdown -->
					<div class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
						{#each Object.entries(archeryAnalysis.scores) as [metric, score]}
							<div class="rounded-lg bg-gray-700/30 p-3">
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
									<div class="h-2 w-12 overflow-hidden rounded-full bg-gray-600">
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
						<div class="rounded-lg border border-orange-600/50 bg-orange-900/30 p-4">
							<h4 class="mb-2 font-semibold text-orange-300">Form Corrections:</h4>
							<ul class="space-y-1">
								{#each archeryAnalysis.feedback as feedback}
									<li class="text-sm text-orange-200">• {feedback}</li>
								{/each}
							</ul>
						</div>
					{:else}
						<div class="rounded-lg border border-green-600/50 bg-green-900/30 p-4">
							<h4 class="font-semibold text-green-300">Good Form</h4>
							<p class="text-sm text-green-200">Your archery form looks excellent. Keep it up.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
