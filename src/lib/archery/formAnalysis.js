// Archery form analysis functions
// BlazePose keypoint indices for reference:
const KEYPOINTS = {
	NOSE: 0,
	LEFT_EYE: 1,
	RIGHT_EYE: 2,
	LEFT_EAR: 3,
	RIGHT_EAR: 4,
	LEFT_SHOULDER: 11,
	RIGHT_SHOULDER: 12,
	LEFT_ELBOW: 13,
	RIGHT_ELBOW: 14,
	LEFT_WRIST: 15,
	RIGHT_WRIST: 16,
	LEFT_HIP: 23,
	RIGHT_HIP: 24
};

// Calculate angle between three points (in degrees)
function calculateAngle(pointA, pointB, pointC) {
	const vectorBA = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
	const vectorBC = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };

	const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
	const magnitudeBA = Math.sqrt(vectorBA.x * vectorBA.x + vectorBA.y * vectorBA.y);
	const magnitudeBC = Math.sqrt(vectorBC.x * vectorBC.x + vectorBC.y * vectorBC.y);

	if (magnitudeBA === 0 || magnitudeBC === 0) return 0;

	const cosine = dotProduct / (magnitudeBA * magnitudeBC);
	const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
	return (angle * 180) / Math.PI;
}

// Calculate distance between two points
function calculateDistance(pointA, pointB) {
	const dx = pointB.x - pointA.x;
	const dy = pointB.y - pointA.y;
	return Math.sqrt(dx * dx + dy * dy);
}

// Determine if user is right or left handed based on arm positions
function determineDominantHand(keypoints) {
	const leftShoulder = keypoints[KEYPOINTS.LEFT_SHOULDER];
	const rightShoulder = keypoints[KEYPOINTS.RIGHT_SHOULDER];
	const leftWrist = keypoints[KEYPOINTS.LEFT_WRIST];
	const rightWrist = keypoints[KEYPOINTS.RIGHT_WRIST];

	if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return null;

	// Assume the extended arm (further from body center) is the bow arm
	const centerX = (leftShoulder.x + rightShoulder.x) / 2;
	const leftExtension = Math.abs(leftWrist.x - centerX);
	const rightExtension = Math.abs(rightWrist.x - centerX);

	return leftExtension > rightExtension ? 'left' : 'right';
}

// Analyze archery form from pose keypoints
export function analyzeArcheryForm(keypoints) {
	if (!keypoints || keypoints.length < 25) return null;

	const dominantHand = determineDominantHand(keypoints);
	if (!dominantHand) return null;

	// Determine bow arm and draw arm based on dominance
	const bowArm = dominantHand === 'right' ? 'left' : 'right';
	const drawArm = dominantHand;

	const bowShoulder = keypoints[bowArm === 'left' ? KEYPOINTS.LEFT_SHOULDER : KEYPOINTS.RIGHT_SHOULDER];
	const bowElbow = keypoints[bowArm === 'left' ? KEYPOINTS.LEFT_ELBOW : KEYPOINTS.RIGHT_ELBOW];
	const bowWrist = keypoints[bowArm === 'left' ? KEYPOINTS.LEFT_WRIST : KEYPOINTS.RIGHT_WRIST];

	const drawShoulder = keypoints[drawArm === 'left' ? KEYPOINTS.LEFT_SHOULDER : KEYPOINTS.RIGHT_SHOULDER];
	const drawElbow = keypoints[drawArm === 'left' ? KEYPOINTS.LEFT_ELBOW : KEYPOINTS.RIGHT_ELBOW];
	const drawWrist = keypoints[drawArm === 'left' ? KEYPOINTS.LEFT_WRIST : KEYPOINTS.RIGHT_WRIST];

	const leftHip = keypoints[KEYPOINTS.LEFT_HIP];
	const rightHip = keypoints[KEYPOINTS.RIGHT_HIP];
	const nose = keypoints[KEYPOINTS.NOSE];

	// Check if we have all required points
	if (!bowShoulder || !bowElbow || !bowWrist || !drawShoulder || !drawElbow || !drawWrist || !leftHip || !rightHip || !nose) {
		return null;
	}

	const analysis = {
		dominantHand,
		bowArm,
		drawArm,
		scores: {},
		feedback: []
	};

	// 1. BOW ARM STRAIGHTNESS (should be nearly straight, 160-180 degrees)
	const bowArmAngle = calculateAngle(bowShoulder, bowElbow, bowWrist);
	analysis.scores.bowArmStraightness = Math.max(0, Math.min(100, (bowArmAngle - 120) / 0.6)); // Scale 120-180 to 0-100
	if (bowArmAngle < 160) {
		analysis.feedback.push(`Straighten your ${bowArm} arm more (${bowArmAngle.toFixed(1)}°)`);
	}

	// 2. DRAW ARM ANGLE (elbow should be behind the arrow line, ~90-110 degrees at full draw)
	const drawArmAngle = calculateAngle(drawShoulder, drawElbow, drawWrist);
	const idealDrawAngle = 100;
	analysis.scores.drawArmAngle = Math.max(0, 100 - Math.abs(drawArmAngle - idealDrawAngle) * 2);
	if (Math.abs(drawArmAngle - idealDrawAngle) > 15) {
		analysis.feedback.push(`Adjust draw arm elbow position (${drawArmAngle.toFixed(1)}°)`);
	}

	// 3. SHOULDER ALIGNMENT (shoulders should be level and perpendicular to target)
	const shoulderAngle = Math.atan2(
		drawShoulder.y - bowShoulder.y,
		drawShoulder.x - bowShoulder.x
	) * 180 / Math.PI;
	const shoulderLevelness = Math.abs(shoulderAngle);
	analysis.scores.shoulderAlignment = Math.max(0, 100 - shoulderLevelness * 5);
	if (shoulderLevelness > 10) {
		analysis.feedback.push('Level your shoulders');
	}

	// 4. STANCE (hips should be roughly aligned, feet shoulder-width apart)
	const hipAlignment = Math.abs(leftHip.y - rightHip.y);
	const hipWidth = Math.abs(leftHip.x - rightHip.x);
	analysis.scores.stance = Math.max(0, 100 - hipAlignment * 2);
	if (hipAlignment > 20) {
		analysis.feedback.push('Square your stance - align your hips');
	}

	// 5. HEAD POSITION (should be upright and aligned)
	const headTilt = Math.abs(nose.x - (bowShoulder.x + drawShoulder.x) / 2);
	analysis.scores.headPosition = Math.max(0, 100 - headTilt / 2);
	if (headTilt > 30) {
		analysis.feedback.push('Keep your head centered and upright');
	}

	// 6. DRAW LENGTH CONSISTENCY (distance from draw shoulder to draw wrist)
	const drawLength = calculateDistance(drawShoulder, drawWrist);
	analysis.drawLength = drawLength;
	
	// 7. BOW ARM EXTENSION (distance from bow shoulder to bow wrist)
	const bowArmExtension = calculateDistance(bowShoulder, bowWrist);
	analysis.bowArmExtension = bowArmExtension;

	// Overall form score (average of all components)
	const scores = Object.values(analysis.scores);
	analysis.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

	// Add draw detection (basic implementation)
	analysis.isDrawing = drawLength > bowArmExtension * 0.8; // Drawing when draw arm is extended

	return analysis;
}

// Detect archery shot phases
export function detectShotPhase(currentAnalysis, previousAnalysis) {
	if (!currentAnalysis || !previousAnalysis) return 'idle';

	const currentDraw = currentAnalysis.drawLength;
	const previousDraw = previousAnalysis.drawLength;

	// Basic phase detection based on draw length changes
	if (currentDraw > previousDraw + 5) return 'drawing';
	if (currentDraw > 100 && Math.abs(currentDraw - previousDraw) < 3) return 'anchor';
	if (currentDraw < previousDraw - 10) return 'release';
	if (currentDraw < 80) return 'follow_through';

	return 'idle';
}
