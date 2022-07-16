#version 430

uniform sampler2D tex;
uniform float maxVal;
uniform int finestLevel = 5;


in vec2 texCoord;
out vec4 outColor;


void main() {
	outColor = textureLod(tex, texCoord, finestLevel) / maxVal;
}