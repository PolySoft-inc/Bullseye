<script>
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Conversation } from '@elevenlabs/client';
	import { PUBLIC_ELEVENLABS_API_KEY, PUBLIC_ELEVENLABS_AGENT_ID } from '$env/static/public';

	let stream;
	let videoRef;
	let isAnalyzing = false;
	let sessionActive = false;
	let frameCount = 0;
	let captureInterval;
	let coachingTips = [
		'Stand with feet shoulder-width apart',
		'Keep your bow arm straight and strong',
		'Draw with your back muscles, not just your arm',
		'Anchor consistently at the corner of your mouth',
		'Focus on your target, let everything else blur'
	];
	let currentTip = 0;
	let analysisResults = {
		posture: 85,
		armPosition: 72,
		drawLength: 90,
		stability: 78
	};

	// ElevenLabs WebRTC variables
	let conversation = null; // Initialize as null
	let isConnected = false;
	let isSpeaking = false;
	let connectionStatus = 'disconnected';

	/**
	 * Initialize ElevenLabs WebRTC connection
	 */
	async function initializeElevenLabs() {
		try {
			console.log('Initializing ElevenLabs WebRTC connection...');

			// Request microphone access for WebRTC with better error handling
			try {
				const audioStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true
					}
				});
				console.log('Microphone access granted for ElevenLabs');
			} catch (audioError) {
				console.error('Failed to get microphone access:', audioError);
				// Continue without audio if permission denied
			}

			// Start the conversation session with proper callbacks
			conversation = await Conversation.startSession({
				agentId: PUBLIC_ELEVENLABS_AGENT_ID,
				connectionType: 'webrtc',
				onMessage: (message) => {
					console.log('Received message from agent:', message);
				},
				onError: (error) => {
					console.error('ElevenLabs error:', error);
					connectionStatus = 'error';
				},
				onClose: () => {
					console.log('ElevenLabs connection closed');
					connectionStatus = 'disconnected';
					isConnected = false;
				},
				onOpen: () => {
					console.log('ElevenLabs connection opened');
					connectionStatus = 'connected';
					isConnected = true;
				},
				onSpeaking: (speaking) => {
					console.log('Agent speaking:', speaking);
					isSpeaking = speaking;
				}
			});

			console.log('ElevenLabs WebRTC connection established!');

			// Set initial volume
			await conversation.setVolume({ volume: 0.7 });
		} catch (error) {
			console.error('Error initializing ElevenLabs:', error);
			connectionStatus = 'error';
		}
	}

	/**
	 * Function to get the camera stream.
	 */
	async function getStream() {
		try {
			console.log('Requesting camera access...');
			// Request access to the front camera
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false
			});
			console.log('Camera access granted!');
			// Assign the stream to the video element's srcObject
			if (videoRef) {
				videoRef.srcObject = stream;
			}
		} catch (err) {
			console.error('Error accessing camera:', err);
			// Handle permission errors or other issues
		}
	}

	// Call getStream when the component mounts
	onMount(() => {
		getStream();
		// Remove initializeElevenLabs() from here - it will be called when training starts

		// Rotate coaching tips every 4 seconds
		const tipInterval = setInterval(() => {
			currentTip = (currentTip + 1) % coachingTips.length;
		}, 4000);

		// Clean up the stream when the component is destroyed
		return () => {
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}
			if (conversation) {
				conversation.endSession();
			}
			if (captureInterval) {
				clearInterval(captureInterval);
			}
			clearInterval(tipInterval);
		};
	});

	async function startSession() {
		// Only start if not already active
		if (!sessionActive) {
			console.log('Starting new training session...');

			// Initialize ElevenLabs connection when training starts
			await initializeElevenLabs();

			sessionActive = true;
			isAnalyzing = true;
			frameCount = 0;

			// Clear any existing interval first
			if (captureInterval) {
				clearInterval(captureInterval);
			}

			// Start frame capture every second for analysis
			captureInterval = setInterval(() => {
				if (!sessionActive) {
					clearInterval(captureInterval);
					return;
				}

				frameCount++;
				captureFrame();
			}, 1000);
		}
	}

	function captureFrame() {
		// This would capture the current frame and send to backend
		console.log(`Capturing frame ${frameCount} for analysis...`);
		// TODO: Implement actual frame capture and API call
	}

	async function stopSession() {
		// Only stop if currently active
		if (sessionActive) {
			console.log('Stopping training session...');
			sessionActive = false;
			isAnalyzing = false;

			// Clear the capture interval
			if (captureInterval) {
				clearInterval(captureInterval);
				captureInterval = null;
			}

			// End the ElevenLabs conversation when training stops
			if (conversation) {
				try {
					await conversation.endSession();
					conversation = null;
					isConnected = false;
					connectionStatus = 'disconnected';
					console.log('ElevenLabs conversation ended');
				} catch (error) {
					console.error('Error ending ElevenLabs conversation:', error);
				}
			}

			// Keep frameCount for display purposes
			console.log(`Session ended. Total frames analyzed: ${frameCount}`);
		}
	}

	async function resetSession() {
		console.log('Resetting session data...');

		// Stop current session if active
		await stopSession();

		frameCount = 0;

		// Reset analysis data
		analysisResults = {
			posture: 0,
			armPosition: 0,
			drawLength: 0,
			stability: 0
		};

		console.log('Session reset complete');
	}

	/**
	 * Send voice message to ElevenLabs agent
	 */
	async function sendVoiceMessage() {
		if (conversation && isConnected) {
			try {
				// This would trigger voice input and send to the agent
				console.log('Sending voice message to agent...');
				// The actual voice input handling would be implemented here
			} catch (error) {
				console.error('Error sending voice message:', error);
			}
		}
	}
</script>

<div class="h-screen bg-gradient-to-br from-gray-900 to-black pt-6">
	<!-- Main Camera Section -->
	<div class="flex flex-col items-center justify-center p-4">
		<!-- Camera Feed with Overlay -->
		<div class="relative">
			<video
				bind:this={videoRef}
				autoplay
				playsinline
				muted
				class="h-auto w-full max-w-lg -scale-x-100 rounded-xl border-2 border-blue-500 shadow-2xl"
			></video>

			<!-- Analysis Overlay -->
			{#if isAnalyzing}
				<div class="absolute inset-0 animate-pulse rounded-xl border-4 border-green-400">
					<div class="absolute top-2 right-2 h-4 w-4 animate-ping rounded-full bg-red-500"></div>
					<div
						class="bg-opacity-60 absolute bottom-2 left-2 rounded bg-black px-2 py-1 text-sm text-white"
					>
						Analyzing... Frame {frameCount}
					</div>
				</div>
			{/if}
		</div>

		<!-- Session Controls -->
		<div class="mt-6 flex gap-4">
			{#if !stream}
				<div class="flex min-h-[50px] items-center justify-center text-lg text-white">
					<p>Loading camera...</p>
				</div>
			{:else if !sessionActive}
				<Button onclick={startSession} class="bg-green-600 px-8 py-3 text-lg hover:bg-green-700"
					>🏹 Start Training</Button
				>
			{:else}
				<Button onclick={stopSession} class="bg-red-600 px-6 py-3 hover:bg-red-700">⏹ Stop</Button>
				<Button onclick={resetSession} variant="outline" class="px-6 py-3">🔄 Reset</Button>
			{/if}
		</div>

		<!-- Form Analysis Scores -->
		<div class="mt-8 w-full max-w-md">
			<h3 class="mb-3 text-center font-semibold text-white">📊 Form Analysis</h3>
			<div class="space-y-3">
				<!-- Posture Score -->
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span class="text-gray-300">Posture</span>
						<span class="text-white">{analysisResults.posture}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-gray-700">
						<div
							class="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
							style="width: {analysisResults.posture}%"
						></div>
					</div>
				</div>

				<!-- Arm Position -->
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span class="text-gray-300">Arm Position</span>
						<span class="text-white">{analysisResults.armPosition}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-gray-700">
						<div
							class="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
							style="width: {analysisResults.armPosition}%"
						></div>
					</div>
				</div>

				<!-- Draw Length -->
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span class="text-gray-300">Draw Length</span>
						<span class="text-white">{analysisResults.drawLength}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-gray-700">
						<div
							class="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
							style="width: {analysisResults.drawLength}%"
						></div>
					</div>
				</div>

				<!-- Stability -->
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span class="text-gray-300">Stability</span>
						<span class="text-white">{analysisResults.stability}%</span>
					</div>
					<div class="h-2 w-full rounded-full bg-gray-700">
						<div
							class="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
							style="width: {analysisResults.stability}%"
						></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Session Stats -->
		{#if sessionActive || frameCount > 0}
			<div class="mt-6 rounded-lg bg-gray-700 p-4">
				<h3 class="mb-2 font-semibold text-white">📈 Session Stats</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-300">Frames Analyzed:</span>
						<span class="text-white">{frameCount}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-300">Session Time:</span>
						<span class="text-white"
							>{Math.floor(frameCount / 60)}:{String(frameCount % 60).padStart(2, '0')}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-300">Status:</span>
						<span class="text-white">{sessionActive ? 'Active' : 'Stopped'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-300">Voice Coach:</span>
						<span class="text-white">{isConnected ? 'Connected' : 'Disconnected'}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Voice Feedback Indicator -->
		<div class="mt-6">
			<div class="flex items-center justify-center gap-2 text-sm text-gray-400">
				<div class="h-2 w-2 rounded-full {isConnected ? 'bg-green-500' : 'bg-gray-500'}"></div>
				<span>{isConnected ? 'Voice coaching active' : 'Voice coaching ready'}</span>
			</div>
		</div>
	</div>
</div>
