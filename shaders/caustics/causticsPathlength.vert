#version 430

in vec4 position;

out float pathLength;

uniform	mat4 m_pvm;

void main () {
	
    pathLength = position.z;

	gl_Position = m_pvm * vec4(position.x, 0, position.y, 1);	
}