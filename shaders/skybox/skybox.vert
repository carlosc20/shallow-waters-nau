#version 330

uniform	mat4 m_proj;
uniform	mat4 m_view;
uniform vec3 light_dir;

in vec4 position;

out Data {
    vec4 position;
} DataOut;

void main()
{
    // Remove any translations
    mat4 view = m_view;
    view[3] = vec4(0.0);
    view[0][3] = 0.0;
    view[1][3] = 0.0;
    view[2][3] = 0.0;
    view[3][3] = 0.0;

    // Make z same as w for max 1.0 depth
    gl_Position = (m_proj * view * position).xyww;
    DataOut.position = position;
}