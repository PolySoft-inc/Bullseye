<script>
	import { T, useTask } from '@threlte/core';
	import { interactivity, OrbitControls } from '@threlte/extras';
	import { onMount } from 'svelte';

	interactivity();

	export let poses = [];
	export let lerpPoints3D = [];

	// Pose connections (simplified and more reliable)
	const connections = [
		// Head connections
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 7],
		[0, 4],
		[4, 5],
		[5, 6],
		[6, 8],

		// Torso
		[11, 12],
		[11, 23],
		[12, 24],
		[23, 24],

		// Left arm
		[11, 13],
		[13, 15],
		[15, 17],
		[15, 19],
		[15, 21],

		// Right arm
		[12, 14],
		[14, 16],
		[16, 18],
		[16, 20],
		[16, 22],

		// Left leg
		[23, 25],
		[25, 27],
		[27, 29],
		[29, 31],

		// Right leg
		[24, 26],
		[26, 28],
		[28, 30],
		[30, 32]
	];

	// Simple function to check if we should draw a connection
	function shouldDrawConnection(keypointA, keypointB, pointA, pointB) {
		return (
			keypointA &&
			keypointB &&
			keypointA.confidence > 0.5 &&
			keypointB.confidence > 0.5 &&
			pointA &&
			pointB
		);
	}
</script>

<!-- Camera with orbit controls -->
<T.PerspectiveCamera
	makeDefault
	position={[1, 0, 1]}
	oncreate={(ref) => {
		ref.lookAt(0, -0.5, 0);
	}}
>
	<OrbitControls enableDamping autoRotate />
</T.PerspectiveCamera>

<!-- Lighting -->
<T.DirectionalLight position={[10, 10, 5]} intensity={1} castShadow />
<T.AmbientLight intensity={0.4} />

<!-- Ground plane -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow position.y={-1}>
	<T.PlaneGeometry args={[2, 2]} />
	<T.MeshStandardMaterial color="#AAAAAA" />
</T.Mesh>

<!-- 3D Pose Points and Skeleton -->
{#if poses.length > 0 && lerpPoints3D.length > 0}
	<!-- Draw keypoints as spheres -->
	{#each lerpPoints3D as point, i}
		{#if point && poses[0].keypoints[i] && poses[0].keypoints[i].confidence > 0.5}
			<!-- Only show high-confidence points (green) -->
			<T.Mesh position={[point.x, -point.y, -point.z]} castShadow>
				<T.SphereGeometry args={[0.03]} />
				<T.MeshStandardMaterial color="#00ff00" emissive="#002200" />
			</T.Mesh>
		{/if}
	{/each}

	<!-- Draw skeleton connections as simple lines -->
	{#each connections as connection}
		{@const [a, b] = connection}
		{@const pointA = lerpPoints3D[a]}
		{@const pointB = lerpPoints3D[b]}
		{@const keypointA = poses[0].keypoints[a]}
		{@const keypointB = poses[0].keypoints[b]}
		{@const shouldShow = shouldDrawConnection(keypointA, keypointB, pointA, pointB)}

		<!-- Always render the line but make it invisible when not needed -->
		<T.Line visible={shouldShow}>
			<T.BufferGeometry>
				<T.BufferAttribute
					attach="attributes.position"
					args={[
						shouldShow && pointA && pointB
							? new Float32Array([pointA.x, -pointA.y, -pointA.z, pointB.x, -pointB.y, -pointB.z])
							: new Float32Array([0, 0, 0, 0, 0, 0]),
						3
					]}
				/>
			</T.BufferGeometry>
			<T.LineBasicMaterial color="#00cccc" />
		</T.Line>
	{/each}
{/if}
