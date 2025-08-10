<script>
	import { onMount } from "svelte";
	import { Button } from "$lib/components/ui/button/index.js";

	let stream;
	let videoRef;
	let isAnalyzing = false;
	let sessionActive = false;
	let frameCount = 0;
	let coachingTips = ["Stand with feet shoulder-width apart", "Keep your bow arm straight and strong", "Draw with your back muscles, not just your arm", "Anchor consistently at the corner of your mouth", "Focus on your target, let everything else blur"];
	let currentTip = 0;
	let analysisResults = {
		posture: 85,
		armPosition: 72,
		drawLength: 90,
		stability: 78,
	};

	/**
	 * Function to get the camera stream.
	 */
	async function getStream() {
		try {
			console.log("Requesting camera access...");
			// Request access to the front camera
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false,
			});
			console.log("Camera access granted!");
			// Assign the stream to the video element's srcObject
			if (videoRef) {
				videoRef.srcObject = stream;
			}
		} catch (err) {
			console.error("Error accessing camera:", err);
			// Handle permission errors or other issues
		}
	}

	// Call getStream when the component mounts
	onMount(() => {
		getStream();

		// Rotate coaching tips every 4 seconds
		const tipInterval = setInterval(() => {
			currentTip = (currentTip + 1) % coachingTips.length;
		}, 4000);

		// Clean up the stream when the component is destroyed
		return () => {
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}
			clearInterval(tipInterval);
		};
	});

	function startSession() {
		sessionActive = true;
		isAnalyzing = true;
		frameCount = 0;

		// Simulate frame capture every second for analysis
		const captureInterval = setInterval(() => {
			if (!sessionActive) {
				clearInterval(captureInterval);
				return;
			}

			frameCount++;
			captureFrame();
		}, 1000);
	}

	function captureFrame() {
		// This would capture the current frame and send to backend
		console.log(`Capturing frame ${frameCount} for analysis...`);
		// TODO: Implement actual frame capture and API call
	}

	function stopSession() {
		sessionActive = false;
		isAnalyzing = false;
		frameCount = 0;
	}

	function resetSession() {
		stopSession();
		// Reset any analysis data
		analysisResults = {
			posture: 0,
			armPosition: 0,
			drawLength: 0,
			stability: 0,
		};
	}
</script>

<div class=" lg:flex-row h-screen bg-gradient-to-br from-gray-900 to-black pt-6">
	<!-- Main Camera Section -->
	<div class="flex-1 flex flex-col items-center justify-center p-4">
		<!-- Camera Feed with Overlay -->
		<div class="relative">
			<video bind:this={videoRef} autoplay playsinline muted class="w-full max-w-lg h-auto rounded-xl shadow-2xl -scale-x-100 border-2 border-blue-500"></video>

			<!-- Analysis Overlay -->
			{#if isAnalyzing}
				<div class="absolute inset-0 border-4 border-green-400 rounded-xl animate-pulse">
					<div class="absolute top-2 right-2 bg-red-500 w-4 h-4 rounded-full animate-ping"></div>
					<div class="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-sm">
						Analyzing... Frame {frameCount}
					</div>
				</div>
			{/if}
		</div>

		<!-- Session Controls -->
		<div class="mt-6 flex gap-4">
			{#if !stream}
				<div class="flex items-center justify-center min-h-[50px] text-white text-lg">
					<p>Loading camera...</p>
				</div>
			{:else if !sessionActive}
				<Button onclick={startSession} class="bg-green-600 hover:bg-green-700 px-8 py-3 text-lg">🏹 Start Training</Button>
			{:else}
				<Button onclick={stopSession} class="bg-red-600 hover:bg-red-700 px-6 py-3">⏹ Stop</Button>
				<Button onclick={resetSession} variant="outline" class="px-6 py-3">🔄 Reset</Button>
			{/if}
		</div>
	</div>

	<!-- Coaching Panel -->
	<div class="lg:w-80 p-6 flex flex-col">
		<!-- AI Coach Status -->
		<div class="mb-6">
			<h2 class="text-xl font-bold text-white mb-2">🎯 AI Archery Coach</h2>
			<div class="flex items-center gap-2 text-sm">
				<div class="w-2 h-2 rounded-full {sessionActive ? 'bg-green-400' : 'bg-gray-500'}"></div>
				<span class="text-gray-300">
					{sessionActive ? "Actively Coaching" : "Ready to Help"}
				</span>
			</div>
		</div>

		<!-- Form Analysis Scores -->
		<div class="mb-6">
			<h3 class="text-white font-semibold mb-3">📊 Form Analysis</h3>
			<div class="space-y-3">
				<!-- Posture Score -->
				<div>
					<div class="flex justify-between text-sm mb-1">
						<span class="text-gray-300">Posture</span>
						<span class="text-white">{analysisResults.posture}%</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500" style="width: {analysisResults.posture}%"></div>
					</div>
				</div>

				<!-- Arm Position -->
				<div>
					<div class="flex justify-between text-sm mb-1">
						<span class="text-gray-300">Arm Position</span>
						<span class="text-white">{analysisResults.armPosition}%</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500" style="width: {analysisResults.armPosition}%"></div>
					</div>
				</div>

				<!-- Draw Length -->
				<div>
					<div class="flex justify-between text-sm mb-1">
						<span class="text-gray-300">Draw Length</span>
						<span class="text-white">{analysisResults.drawLength}%</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500" style="width: {analysisResults.drawLength}%"></div>
					</div>
				</div>

				<!-- Stability -->
				<div>
					<div class="flex justify-between text-sm mb-1">
						<span class="text-gray-300">Stability</span>
						<span class="text-white">{analysisResults.stability}%</span>
					</div>
					<div class="w-full bg-gray-700 rounded-full h-2">
						<div class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-500" style="width: {analysisResults.stability}%"></div>
					</div>
				</div>
			</div>
		</div>

		<!-- Session Stats -->
		{#if sessionActive}
			<div class="bg-gray-700 rounded-lg p-4">
				<h3 class="text-white font-semibold mb-2">📈 Session Stats</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-300">Frames Analyzed:</span>
						<span class="text-white">{frameCount}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-300">Session Time:</span>
						<span class="text-white">{Math.floor(frameCount / 60)}:{String(frameCount % 60).padStart(2, "0")}</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Voice Feedback Indicator -->
		<div class="mt-auto">
			<div class="flex items-center justify-center gap-2 text-gray-400 text-sm">
				<div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
				<span>Voice coaching ready</span>
			</div>
		</div>
	</div>
</div>
