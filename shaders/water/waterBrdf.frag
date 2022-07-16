//=======================================================================================
// BRDF
//=======================================================================================

// roughness [0,1]
uniform float alpha; 



// ------------------------------------------------------------------------------
// GGX distribution
// Walter 2007 -> Microfacet Models for Refraction through Rough Surfaces
float dist_GGX(float alpha, float dot_NH) {

    float alpha_s = alpha * alpha;
    float denom = PI * pow(dot_NH * dot_NH * (alpha_s - 1) + 1, 2);

    if (dot_NH > 0)
        return alpha_s / denom;
    else 
        return 0;
}

// ------------------------------------------------------------------------------
// Geometric shadowing
// Eric Heitz. 2014. -> Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs.
// Earl Hammon. 2017. -> PBR Diffuse Lighting for GGX+Smith Microsurfaces.

float geom_GGX_aux(float alpha2, float dot_xN, float dot_Hx) {

    float dot_xN_squared = dot_xN * dot_xN;
    float denom = 1 + sqrt(1 + alpha * (1 - dot_xN_squared)/dot_xN_squared);
    if (dot_Hx/dot_xN > 0) // TODO experimentar remover
        return 2 / denom;
    else 
        return 0;
}

// Smith masking and shadowing
float geometric_GGX(float alpha, float dot_HL, float dot_LN, float dot_VN) {

    float alpha2 = alpha * alpha;
    return geom_GGX_aux(alpha2, dot_VN, dot_HL) * geom_GGX_aux(alpha2, dot_LN, dot_HL);
}

// ------------------------------------------------------------------------------
// Schlick's approximation to the Fresnel term
float fresnel_schlick(float f0, float dot_VH) {

    return f0 + (1.0 - f0) * pow(1.0 - dot_VH, 5.0);
}

// ------------------------------------------------------------------------------
// Visibility term 
// v = g / (4 * dot_NL * dot_NV)
// Eric Heitz. 2014. -> Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs.
// Earl Hammon. 2017. -> PBR Diffuse Lighting for GGX+Smith Microsurfaces.
float visibility_SmithGGXCorrelated(float dot_NV, float dot_NL, float alpha) {
    float a2 = alpha * alpha;
    float visV = dot_NL * sqrt(dot_NV * dot_NV * (1.0 - a2) + a2);
    float visL = dot_NV * sqrt(dot_NL * dot_NL * (1.0 - a2) + a2);
    return 0.5 / (visV + visL);
}

float visibility_Kelemen(float dot_LH) {
    return 0.25 / (dot_LH * dot_LH);
}

/*
    diffuse -> diffuse term
	v -> view dir
	n -> normal
    l -> light dir
*/
vec3 cookTorranceSpecular(vec3 n, vec3 v, vec3 l) {
    
    // half vector
    vec3 h = normalize(l + v);

	// aux variables to simplify equations
	float dot_NL = clamp(dot(n,l), 0.0, 1.0);
	float dot_NV = clamp(dot(n,v), 0.0, 1.0);
    float dot_HV = clamp(dot(h,v), 0.0, 1.0);
    float dot_NH = clamp(dot(n,h), 0.0, 1.0);
    float dot_HL = clamp(dot(h,l), 0.0, 1.0);

	// ---------------------------------------------------------------------------------
	// Cook-Torrance Specular Term

    // fresnel reflectance
    float f0 = (waterIor - 1) / (waterIor + 1); // 0.02 for water
	f0 *= f0;

	// remap perceptual to linear roughness
	float roughness = alpha * alpha;

    float d = dist_GGX(roughness, dot_NH);
    float vis = visibility_SmithGGXCorrelated(dot_NV, dot_NL, roughness);
    float f = fresnel_schlick(f0, dot_HV);

    float specular =  d * vis * f;  

    return vec3(specular);
}

// Version without visibility term
vec3 cookTorranceBrdfNoVis(vec3 diffuse, vec3 n, vec3 v, vec3 l) {
    
    // half vector
    vec3 h = normalize(l + v);

	// aux variables to simplify equations
	float dot_NL = clamp(dot(n,l), 0.0, 1.0);
	float dot_NV = clamp(dot(n,v), 0.0, 1.0);
    float dot_HV = clamp(dot(h,v), 0.0, 1.0);
    float dot_NH = clamp(dot(n,h), 0.0, 1.0);
    float dot_HL = clamp(dot(h,l), 0.0, 1.0);

	// ---------------------------------------------------------------------------------
	// Cook-Torrance Specular Term

    // fresnel reflectance
    float f0 = (waterIor - 1) / (waterIor + 1); // 0.02 for water
	f0 *= f0;

	// remap perceptual to linear roughness
	float roughness = alpha * alpha;

    float d = dist_GGX(roughness, dot_NH);
    float g = geometric_GGX(roughness, dot_HL, dot_NL, dot_NV);
    float f = fresnel_schlick(f0, dot_HV);

    float specular =  d * f * g / (4 * dot_NL * dot_NV  + 0.00001);  

    // combine with diffuse term and intensity
	return diffuse * ambient + dot_NL * (specular + (1 - f) * diffuse);
}

// ------------------------------------------------------------------------------
// diffuse only
vec3 lambert(vec3 diffuse, vec3 n, vec3 l) {
    
	float intensity = max(dot(n,l), ambient);
	
	return intensity * diffuse;
}

// ------------------------------------------------------------------------------
// Blinn-Phong
vec3 blinnPhongBrdf(vec3 diffuse, vec3 n, vec3 v, vec3 l) {

    float intensity = max(dot(n,l), 0.0);

    float specInt = 0.0;
    if (intensity > 0.0) {

        // half vector
        vec3 h = normalize(l+v);
        float shininess = 16;
        specInt = pow(max(dot(h,n),0.0), shininess);
    }

	return max(intensity * diffuse + specInt, diffuse * ambient);
}
