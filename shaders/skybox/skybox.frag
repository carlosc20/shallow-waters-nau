#version 330

uniform samplerCube skybox;

in Data {
    vec4 position;
} DataIn;

out vec4 color;

void main()
{
    color = texture(skybox, -DataIn.position.xyz);
}