#version 430

in vec4 position;
in vec2 texCoord0;


out vec2 texCoord;

void main() {

	gl_Position = position;
	texCoord = texCoord0;	
}