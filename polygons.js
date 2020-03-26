var canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");

var width = canvas.width;
var height = canvas.height;
var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

let pixels = new Pixels(width, height);
let mesh = createTriangleMesh(width, height, 50);

let color = [0, 0, 0, 25];
let blank = [0, 0, 0, 50];
let duplicate = [0, 255, 0, 255];

for(let i = 0; i < width*height; i++) {
	pixels.pixels[i] = blank;
}

mesh.forEach(triangle => {
	let p0 = [...triangle[0], ...getRandomColor()];
	let p1 = [...triangle[1], ...getRandomColor()];
	let p2 = [...triangle[2], ...getRandomColor()];

	drawSmoothColorPolygon(
		p0, p1, p2,
		(x, y, r, g, b, a) => {
			pixels.pixels[y*width+x] = [r, g, b, a];
		}
	)
});

pixels.draw();


function getRandomInt(min, max) {
	return Math.floor(Math.random()*(max-min+1)) + min;
}

function getRandomColor() {
	return [getRandomInt(0, 255), getRandomInt(0, 255), getRandomInt(0, 255), 255];
}

function Slope(dependentVarInitial, dependentVarFinal, independentVarDelta) {
	this.dependentVarDelta = dependentVarFinal - dependentVarInitial;
	this.independentVarDelta = independentVarDelta;
	this.slope = this.dependentVarDelta/this.independentVarDelta;
	this.dependentVarValue = dependentVarInitial;

	this.get = function() {
		return this.dependentVarValue;
	};
	this.advance = function() {
		this.dependentVarValue += this.slope;
	};
}

function rasterizeTriangle(p0, p1, p2, getXY, makeSlope, drawScanLine) {
	if(p1[1] < p0[1])
		[p0, p1] = [p1, p0];
	if(p2[1] < p0[1])
		[p0, p2] = [p2, p0];
	if(p2[1] < p1[1])
		[p1, p2] = [p2, p1];

	if(p1[1] == p0[1] && p1[0] < p0[0])
		[p0, p1] = [p1, p0];
	if(p2[1] == p1[1] && p2[0] < p1[0])
		[p1, p2] = [p2, p1];

	let [x0, y0] = p0;
	let [x1, y1] = p1;
	let [x2, y2] = p2;

	if(y0 == y2)
		return;

	let shortside = 0;
	if(x1 == x2) {
		shortside = Number(x2 > x0);
	}
	else {
		shortside =	Number(x2 < x1);
	}

	let sides = [];
	sides[(shortside+1)%2] =  makeSlope(p0, p2, y2-y0);

	if(y0 != y1) {
		sides[shortside] = makeSlope(p0, p1, y1-y0);

		for(let y = y0; y < y1; y++) {
			drawScanLine(y, sides[0], sides[1]);
		}
	}
	if(y1 != y2) {
		sides[shortside] = makeSlope(p1, p2, y2-y1);

		for(let y = y1; y < y2; y++) {
			drawScanLine(y, sides[0], sides[1]);
		}
	}
}

function drawSmoothColorPolygon(p0, p1, p2, plot) {
	rasterizeTriangle(p0, p1, p2,
		point => [point[0], point[1]],
		(from, to, deltaY) => {
			let slopes = []

			slopes[0] = new Slope(from[0], to[0], deltaY);

			for(let i = 0; i < from.length-2; i++) {
				slopes[i+1] = new Slope(from[i+2], to[i+2], deltaY);
			}

			return slopes;
		},
		(y, leftSlopeData, rightSlopeData) => {
			let leftX = Math.trunc(leftSlopeData[0].get());
			let rightX = Math.trunc(rightSlopeData[0].get());

			let props = [];
			for(let i = 0; i < leftSlopeData.length-1; i++) {
				props[i] = new Slope(
					leftSlopeData[i+1].get(),
					rightSlopeData[i+1].get(),
					rightX-leftX
				);
			}

			for(let x = leftX; x < rightX; x++) {
				plot(x, y, ...props.map(prop=>prop.get()));

				props.forEach(prop => prop.advance());
			}

			leftSlopeData.forEach(slopeData => slopeData.advance());
			rightSlopeData.forEach(slopeData => slopeData.advance());
		}
	);
}


function Pixels(width, height) {
	this.width = width;
	this.height = height;
	this.pixels = [];

	this.draw = function() {
		for(let i = 0; i < this.pixels.length; i++) {
			imageData.data[i*4] = this.pixels[i][0];
			imageData.data[i*4+1] = this.pixels[i][1];
			imageData.data[i*4+2] = this.pixels[i][2];
			imageData.data[i*4+3] = this.pixels[i][3];
		}
		ctx.putImageData(imageData, 0, 0);
	};
}

function createTriangleMesh(width, height, subdivide) {
	let points = [[0,0], [width-1, 0], [width-1, height-1], [0, height-1]];
	let triangles = [[0,1,2], [0,2,3]];

	function randomRange(min, max) {
		return (Math.random()*(max-min)+min);
	}

	function len(edge, triangle) {
		[x0, y0] = points[triangle[edge]];
		[x1, y1] = points[triangle[(edge+1)%3]];
		return ((x0-x1)*(x0-x1)+(y0-y1)*(y0-y1));
	}
	
	for(let n = 0; n < subdivide; n++) {
		let triangleIndex = 0;
		let edge = 0;

		for(let p = 0; p < triangles.length*3; p++) {
			let currentTriangle = triangles[Math.trunc(p/3)];
			if(len(p%3, currentTriangle) > len(edge, triangles[triangleIndex])) {
				edge = p%3;
				triangleIndex = Math.trunc(p/3);
			}
		}

		let before = triangles[triangleIndex];
		let neighbor = triangles[triangleIndex];

		let p0Index = before[edge];
		let p1Index = before[(edge+1)%3];
		let p2Index = before[(edge+2)%3];
		let newPointIndex = points.length;
		let neighborPointIndex = p2Index;
		
		let neighborTriangleIndex = 0;
		let hasNeighbor = false;
		for(let other = 0; other < triangles.length*3; other++) {
			if(triangles[Math.trunc(other/3)][other%3] == p1Index &&
				triangles[Math.trunc(other/3)][(other+1)%3] == p0Index) {

				neighbor = triangles[Math.trunc(other/3)];
				neighborPointIndex = neighbor[(other+2)%3];
				neighborTriangleIndex = Math.trunc(other/3);
				hasNeighbor = true;
				break;
			}
		}
		
		if(!hasNeighbor) {
			triangles[triangleIndex] = [p0Index, newPointIndex, p2Index];
			triangles.push([p2Index, newPointIndex, p1Index]);	
		}
		else {
			triangles[triangleIndex] = [p0Index, newPointIndex, p2Index];
			triangles[neighborTriangleIndex] = [newPointIndex, neighborPointIndex, p1Index];
			triangles.push([p2Index, newPointIndex, p1Index]);
			triangles.push([newPointIndex, p0Index, neighborPointIndex]);
		}
		
		let bias = 0.4;
		let randFraction = randomRange(bias, 1-bias);

		let deltaX = points[p1Index][0]-points[p0Index][0];
		let deltaY = points[p1Index][1]-points[p0Index][1];

		points.push([
			Math.trunc(points[p0Index][0] + deltaX*randFraction),
			Math.trunc(points[p0Index][1] + deltaY*randFraction)
		]);
	}
	
	let result = [];
	triangles.forEach(triangle =>
		result.push([
			points[triangle[0]],
			points[triangle[1]],
			points[triangle[2]]
		])
	);

	return result;
}

