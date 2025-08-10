<script>
	import { onMount } from 'svelte';
	import p5 from 'p5';
	import ml5 from 'ml5';
	import { Canvas } from '@threlte/core';
	import Pose3DScene from '$lib/components/Pose3DScene.svelte';

	let p5Instance;
	let video;
	let bodyPose;
	let poses = [];
	let lerpPoints; // For smooth interpolation in 2D
	let lerpPoints3D = []; // For smooth interpolation in 3D

	function sketch(p) {
		p.setup = async function () {
			p.createCanvas(640, 480);

			// Set frame rate to 30 FPS for smoother pose tracking
			p.frameRate(30);

			// Load the bodyPose model with smoothing options
			bodyPose = await ml5.bodyPose('BlazePose', {
				modelComplexity: 1,
				smoothLandmarks: true,
				enableSegmentation: false,
				smoothSegmentation: false,
				minDetectionConfidence: 0.5,
				minTrackingConfidence: 0.5
			});

			// Create the video and hide it
			video = p.createCapture(p.VIDEO);
			video.size(640, 480);
			video.hide();

			// Start detecting poses in the webcam video
			bodyPose.detectStart(video, gotPoses);
		};

		p.draw = function () {
			// Only draw if we have video
			if (video) {
				// Draw the webcam video
				p.image(video, 0, 0, p.width, p.height);

				// Draw interpolated poses
				if (poses.length > 0) {
					let pose = poses[0];

					// Initialize interpolation points on first detection
					if (!lerpPoints) {
						lerpPoints = [];
						lerpPoints3D = [];
						for (let i = 0; i < pose.keypoints.length; i++) {
							lerpPoints[i] = p.createVector(pose.keypoints[i].x, pose.keypoints[i].y);
							// Initialize 3D points (use keypoints3D if available, otherwise fake Z)
							if (pose.keypoints3D && pose.keypoints3D[i]) {
								lerpPoints3D[i] = {
									x: pose.keypoints3D[i].x,
									y: pose.keypoints3D[i].y,
									z: pose.keypoints3D[i].z
								};
							} else {
								// Create realistic 3D coordinates from 2D data
								let normalizedX = (pose.keypoints[i].x - 320) / 320; // -1 to 1
								let normalizedY = (pose.keypoints[i].y - 240) / 240; // -1 to 1

								lerpPoints3D[i] = {
									x: normalizedX,
									y: -normalizedY, // Flip Y for correct orientation
									z: 0 // Flat for 2D fallback
								};
							}
						}
					}

					// Smoothly interpolate keypoints
					for (let i = 0; i < pose.keypoints.length; i++) {
						let keypoint = pose.keypoints[i];
						let lerpPoint = lerpPoints[i];
						let lerpPoint3D = lerpPoints3D[i];
						let amt = 0.3; // Interpolation amount (increased for more reactivity)

						if (keypoint.confidence > 0.3) {
							// 2D interpolation
							lerpPoint.x = p.lerp(lerpPoint.x, keypoint.x, amt);
							lerpPoint.y = p.lerp(lerpPoint.y, keypoint.y, amt);

							// 3D interpolation - ensure lerpPoint3D exists
							if (lerpPoint3D && pose.keypoints3D && pose.keypoints3D[i]) {
								let kp3D = pose.keypoints3D[i];
								lerpPoint3D.x = p.lerp(lerpPoint3D.x, kp3D.x, amt);
								lerpPoint3D.y = p.lerp(lerpPoint3D.y, kp3D.y, amt);
								lerpPoint3D.z = p.lerp(lerpPoint3D.z, kp3D.z, amt);
							} else if (lerpPoint3D) {
								// Fallback: use normalized 2D coordinates with better scaling
								let normalizedX = (keypoint.x - 320) / 320; // -1 to 1
								let normalizedY = (keypoint.y - 240) / 240; // -1 to 1
								lerpPoint3D.x = p.lerp(lerpPoint3D.x, normalizedX, amt);
								lerpPoint3D.y = p.lerp(lerpPoint3D.y, -normalizedY, amt); // Flip Y
								lerpPoint3D.z = p.lerp(lerpPoint3D.z, 0, amt); // Keep Z at 0 for 2D fallback
							}

							// Draw interpolated keypoints
							p.fill(0, 255, 0);
							p.noStroke();
							p.circle(lerpPoint.x, lerpPoint.y, 10);
						}
					}

					// Force Svelte reactivity by reassigning the array
					lerpPoints3D = [...lerpPoints3D];

					// Debug: Log occasionally to verify 3D updates
					if (p.frameCount % 60 === 0) {
						if (lerpPoints3D.length > 0 && lerpPoints3D[0]) {
							console.log('Nose 3D position:', lerpPoints3D[0]);
							console.log('3D points count:', lerpPoints3D.length);
						}
					}
				}
			}
		};
	}

	// Callback function for when bodyPose outputs data
	function gotPoses(results) {
		// Save the output to the poses variable
		poses = results;

		// Debug: Check if we have 3D data (only log occasionally)
		if (poses.length > 0 && Math.random() < 0.1) {
			// Log 10% of the time
			const pose = poses[0];
			if (pose.keypoints3D) {
				console.log('3D keypoints available:', pose.keypoints3D.length);
				// Log a specific point to see if it's changing
				if (pose.keypoints3D[0]) {
					console.log(
						'Nose position:',
						pose.keypoints3D[0].x.toFixed(3),
						pose.keypoints3D[0].y.toFixed(3),
						pose.keypoints3D[0].z.toFixed(3)
					);
				}
			} else {
				console.log('No 3D keypoints - using 2D fallback');
			}
		}
	}

	onMount(() => {
		// Create p5 instance and attach to a div
		const container = document.getElementById('p5-container');
		p5Instance = new p5(sketch, container);

		// Make canvas responsive after it's created
		setTimeout(() => {
			const canvas = container.querySelector('canvas');
			if (canvas) {
				canvas.style.maxWidth = '100%';
				canvas.style.height = 'auto';
			}
		}, 100);

		// Cleanup function
		return () => {
			if (p5Instance) {
				p5Instance.remove();
			}
		};
	});
</script>

<div class="h-screen bg-gradient-to-br from-gray-900 to-black pt-6 lg:flex-row">
	<!-- Main Camera Section -->
	<div class="flex flex-1 flex-col items-center justify-center p-4">
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
	</div>
</div>
