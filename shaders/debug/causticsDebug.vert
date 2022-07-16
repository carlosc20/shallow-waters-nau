#version 430

in vec4 position;

out float intensity;

uniform	mat4 m_pvm;

void main () {
	
    intensity = position.w;

    gl_Position = m_pvm * vec4(position.x, position.y, position.z, 1);	
}