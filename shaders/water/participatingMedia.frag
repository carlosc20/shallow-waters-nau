//=======================================================================================
// Participating Media: absorption and scattering
//=======================================================================================

// RGB -> wavelengths 650, 510, 475
// pure water absorption (1/m)
// https://omlc.org/spectra/water/abs/index.html
const vec3 waterAbsorptionCoef = vec3(0.34, 0.0325, 0.0114);

// (1/m), [0, +inf[
uniform vec3 absorptionCoefBase; 
uniform float concAbsorb;

uniform vec3 scatterDiffuse;
uniform float concScatter;

vec3 extinctionCoef() {
	vec3 absorptionCoef = absorptionCoefBase * concAbsorb + waterAbsorptionCoef;
	return max(vec3(0), absorptionCoef);
}

// Beer–Lambert law
vec3 transmittance(float pathLength) {
	return exp(-pathLength * extinctionCoef());
}

vec3 scatterColor() {
	return scatterDiffuse * concScatter;
}
