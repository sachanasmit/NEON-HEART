// JavaScript Document
var canvas = document.getElementById("canvas");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the GL context
var gl = canvas.getContext('webgl');
if (!gl) {
    alert("WebGL is not supported on your browser or device.");
}

// Time
var time = 0.0;

//***** Shader sources *****

var vertexSource = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

var fragmentSource = `
precision highp float;

uniform float width;
uniform float height;
vec2 resolution = vec2(width, height);

uniform float time;

#define POINT_COUNT 8

vec2 points[POINT_COUNT];
const float speed = -0.5;
const float len = 0.25;
float intensity = 1.3;
float radius = 0.008;

// Quadratic Bézier distance function
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {    
    vec2 a = B - A;
    vec2 b = A - 2.0 * B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;

    float kk = 1.0 / dot(b, b);
    float kx = kk * dot(a, b);
    float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
    float kz = kk * dot(d, a);      

    float res = 0.0;

    float p = ky - kx * kx;
    float p3 = p * p * p;
    float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
    float h = q * q + 4.0 * p3;

    if (h >= 0.0) { 
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
        float t = uv.x + uv.y - kx;
        t = clamp(t, 0.0, 1.0);

        vec2 qos = d + (c + b * t) * t;
        res = length(qos);
    } else {
        float z = sqrt(-p);
        float v = acos(q / (p * z * 2.0)) / 3.0;
        float m = cos(v);
        float n = sin(v) * 1.732050808;
        vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
        t = clamp(t, 0.0, 1.0);

        vec2 qos = d + (c + b * t.x) * t.x;
        float dis = dot(qos, qos);
        res = dis;

        qos = d + (c + b * t.y) * t.y;
        dis = dot(qos, qos);
        res = min(res, dis);
        
        qos = d + (c + b * t.z) * t.z;
        dis = dot(qos, qos);
        res = min(res, dis);

        res = sqrt(res);
    }
    
    return res;
}

vec2 getHeartPosition(float t) {
    return vec2(16.0 * sin(t) * sin(t) * sin(t),
                -(13.0 * cos(t) - 5.0 * cos(2.0 * t)
                - 2.0 * cos(3.0 * t) - cos(4.0 * t)));
}

// Glow effect
float getGlow(float dist, float radius, float intensity) {
    return pow(radius / dist, intensity);
}

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getRainbowColor(float t) {
    float hue = fract(t * 0.1);
    return hsv2rgb(vec3(hue, 1.0, 1.0));
}

float getSegment(float t, vec2 pos, float offset, float scale) {
    for (int i = 0; i < POINT_COUNT; i++) {
        points[i] = getHeartPosition(offset + float(i) * len + fract(speed * t) * 6.28);
    }
    
    vec2 c = (points[0] + points[1]) / 2.0;
    vec2 c_prev;
    float dist = 10000.0;
    
    for (int i = 0; i < POINT_COUNT - 1; i++) {
        c_prev = c;
        c = (points[i] + points[i + 1]) / 2.0;
        dist = min(dist, sdBezier(pos, scale * c_prev, scale * points[i], scale * c));
    }
    return max(0.0, dist);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float widthHeightRatio = resolution.x / resolution.y;
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = centre - uv;
    pos.y /= widthHeightRatio;
    pos.y += 0.02;
    float scale = 0.000015 * height;

    float t = time;

    float dist = getSegment(t, pos, 0.0, scale);
    float glow = getGlow(dist, radius, intensity);
    vec3 rainbowColor = getRainbowColor(t);

    vec3 col = vec3(0.0);
    col += glow * rainbowColor;

    dist = getSegment(t, pos, 3.4, scale);
    glow = getGlow(dist, radius, intensity);
    col += glow * rainbowColor;

    col = 1.0 - exp(-col);
    col = pow(col, vec3(0.4545));
    gl_FragColor = vec4(col, 1.0);
}
`;

//***** Utility functions *****

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(widthHandle, window.innerWidth);
    gl.uniform1f(heightHandle, window.innerHeight);
}

// Compile shader and combine with source
function compileShader(shaderSource, shaderType) {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
    }
    return shader;
}

function getAttribLocation(program, name) {
    var attributeLocation = gl.getAttribLocation(program, name);
    if (attributeLocation === -1) {
        throw 'Cannot find attribute ' + name + '.';
    }
    return attributeLocation;
}

function getUniformLocation(program, name) {
    var attributeLocation = gl.getUniformLocation(program, name);
    if (attributeLocation === -1) {
        throw 'Cannot find uniform ' + name + '.';
    }
    return attributeLocation;
}

//***** Create shaders *****

// Create vertex and fragment shaders
var vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

// Create shader programs
var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

gl.useProgram(program);

// Set up rectangle covering entire canvas 
var vertexData = new Float32Array([
    -1.0,  1.0, 	// top left
    -1.0, -1.0, 	// bottom left
     1.0,  1.0, 	// top right
     1.0, -1.0, 	// bottom right
]);

// Create vertex buffer
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Layout of our data in the vertex buffer
var positionHandle = getAttribLocation(program, 'position');

gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(positionHandle,
    2, 				// position is a vec2 (2 values per component)
    gl.FLOAT, // each component is a float
    false, 		// don't normalize values
    2 * 4, 		// two 4 byte float components per vertex (32 bit float is 4 bytes)
    0 				// how many bytes inside the buffer to start from
);

// Set uniform handle
var timeHandle = getUniformLocation(program, 'time');
var widthHandle = getUniformLocation(program, 'width');
var heightHandle = getUniformLocation(program, 'height');

gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

var lastFrame = Date.now();
var thisFrame;

function draw() {
    // Update time
    thisFrame = Date.now();
    time += (thisFrame - lastFrame) / 1000;	
    lastFrame = thisFrame;

    // Send uniforms to program
    gl.uniform1f(timeHandle, time);
    // Draw a triangle strip connecting vertices 0-4
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(draw);
}

draw();
// Define the name and font settings
// Define the name and font settings
var name = "Asmit Sachan";
var font = "48px 'Caveat', cursive";  // Use Caveat font
var glowIntensity = 0.8;  // Adjust this for a stronger/weaker glow

// Neon colors array (you can add or change colors to customize)
var neonColors = [
  'cyan', 'magenta', 'lime', 'yellow', 'blue', 'orange', 'pink', 'red', 'green', 'violet'
];

// Create a new canvas for text rendering (overlay canvas)
var textCanvas = document.createElement('canvas');
var textCtx = textCanvas.getContext('2d');
document.body.appendChild(textCanvas);

// Adjust the canvas size dynamically
textCanvas.width = window.innerWidth;
textCanvas.height = window.innerHeight;
textCanvas.style.position = "absolute";
textCanvas.style.top = "0";
textCanvas.style.left = "0";
textCanvas.style.pointerEvents = "none"; // Don't block other canvas interactions

// Function to draw each character of the name with a different neon glow
function drawNeonText() {
  // Clear the canvas
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);

  // Set the font style
  textCtx.font = font;
  textCtx.textAlign = 'left';  // Align text to the left
  textCtx.textBaseline = 'bottom';  // Position the text from the bottom

  // Loop through each character in the name
  var xOffset = 20; // Starting X position for the text
  for (var i = 0; i < name.length; i++) {
    var char = name[i];

    // Add glow effect (a glow shadow effect for each character)
    textCtx.shadowColor = neonColors[i % neonColors.length];  // Cycle through neon colors
    textCtx.shadowBlur = 20;  // Intensity of the glow

    // Draw each character with the current glow color
    textCtx.fillStyle = 'white';  // The text itself is white
    textCtx.fillText(char, xOffset, textCanvas.height - 20); // Position each character

    // Increment the X position for the next character
    xOffset += textCtx.measureText(char).width;
  }
}

// Call this function to draw the name with neon glow
drawNeonText();

// Update on window resize
window.addEventListener('resize', function() {
  textCanvas.width = window.innerWidth;
  textCanvas.height = window.innerHeight;
  drawNeonText();
});

// Main render loop
function render() {
  drawNeonText();
  requestAnimationFrame(render);
}

render();
