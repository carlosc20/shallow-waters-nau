
-----------------------------------------------
-- Initial setup

-- sets attributes from constants
init = function()
    -- one over dx
    local dx = {}
    getAttr("RENDERER", "CURRENT", "dx", 0, dx)
    setAttr("RENDERER", "CURRENT", "oodx", 0, {1 / dx[1]})

    local nWidth = {0}
    local nHeight = {0}
    getAttr("RENDERER", "CURRENT", "nWidth", 0, nWidth)
    getAttr("RENDERER", "CURRENT", "nHeight", 0, nHeight)

    print("-----------------------------------------------")
    setDimsSolver(nWidth[1], nHeight[1])
    setDimsCaustics()
    setCausticsCameraDim(dx[1], nWidth[1], nHeight[1])
end

-- sets solver compute dimensions
setDimsSolver = function(width,height)

    -- must match solver compute shader!
    local BC_COUNT = 4
    local THREADS_X = 32
    local THREADS_Y = 20

    local dimX = {math.ceil(width / (THREADS_X - 2 * BC_COUNT))} 
    local dimY = {math.ceil(height / (THREADS_Y - 2 * BC_COUNT))}

    setAttr("PASS", "Main#computeStep", "DIM_X", 0, dimX)
    setAttr("PASS", "Main#computeStep", "DIM_Y", 0, dimY)

    print(string.format("Simulation dims set. Threads per group -> X: %s, Y: %s, total: %s; Groups dispatched -> dimX: %s, dimY: %s", THREADS_X, THREADS_Y, THREADS_X * THREADS_Y, dimX[1], dimY[1]))
end

-- sets caustics compute dimensions
setDimsCaustics = function()
    local cWidth = {0}
    local cHeight = {0}
    getAttr("RENDERER", "CURRENT", "cWidth", 0, cWidth)
    getAttr("RENDERER", "CURRENT", "cHeight", 0, cHeight)

    -- must match caustics compute shader!
    local BC_COUNT = 1
    local THREADS_X = 12
    local THREADS_Y = 12

    local dimX = {math.ceil(cWidth[1] / (THREADS_X - 2 * BC_COUNT))} 
    local dimY = {math.ceil(cHeight[1] / (THREADS_Y - 2 * BC_COUNT))}

    setAttr("PASS", "Main#computeCausticsBuffer", "DIM_X", 0, dimX)
    setAttr("PASS", "Main#computeCausticsBuffer", "DIM_Y", 0, dimY)

    print(string.format("Caustics dims set. Threads per group -> X: %s, Y: %s, total: %s; Groups dispatched -> dimX: %s, dimY: %s", THREADS_X, THREADS_Y, THREADS_X * THREADS_Y, dimX[1], dimY[1]))
end

-- sets caustics map camera params
-- camera has top down orthogonal view that fits caustics map
setCausticsCameraDim = function(dx, width, height)

    local z = (height-1) * dx * 0.5
    local x = (width-1) * dx * 0.5
    local position = {x, 30, z}
    setAttr("CAMERA", "AboveCamera", "POSITION", 0, position)
    setAttr("CAMERA", "AboveCamera", "TOP", 0, {z})
    setAttr("CAMERA", "AboveCamera", "BOTTOM", 0, {-z})
    setAttr("CAMERA", "AboveCamera", "RIGHT", 0, {x})
    setAttr("CAMERA", "AboveCamera", "LEFT", 0, {-x})
    
    setAttr("CAMERA", "AboveCamera", "NEAR", 0, {1})
    setAttr("CAMERA", "AboveCamera", "FAR", 0, {31})

    print(string.format("Caustics camera set, X: %s, Z: %s", x, z))
end

-----------------------------------------------
-- Maximum mipmap initialization

-- iterates through each level
testMipmap = function() 

	local level = {0}
	local size = {0}
	local levels = {0}
	local exp = {0}
	getAttr("RENDERER", "CURRENT", "levels", 0, levels)
	getAttr("PASS", "CURRENT", "currentMipLevel", 0, level)
	
	if level[1] == levels[1] then
		setAttr("PASS", "CURRENT", "currentMipLevel", 0, {0})

		return false
	else
		level[1] = level[1] + 1
		exp[1] = levels[1] - level[1]
		if exp[1] == 0 then
			size[1] = 1
		else 
            -- size = 2^exp
            size[1] = 2
			for i=2,exp[1] do
				size[1] = size[1] * 2
			end	
		end
		
		setAttr("PASS", "CURRENT", "currentMipLevel", 0, level)
		setAttr("PASS", "CURRENT", "DIM_X", 0, size)
		setAttr("PASS", "CURRENT", "DIM_Y", 0, size)
		
		setAttr("IMAGE_TEXTURE", "Main::mat_maxMipmap", "LEVEL", 1, level)
        --print("maximum mipmap, level:", level[1], ", size:", size[1])
		return true
	end
end

-----------------------------------------------
-- Simulation data initialization, can be reset
currentTime = 0;
frameTime = 0;


testInitSim = function()
    local shouldInit = {}
    getAttr("RENDERER", "CURRENT", "shouldInit", 0, shouldInit)

    return shouldInit[1] ~= 0
end

-- used at last initialization pass, resets simulation vars if true
testInitSimReset = function()
    local test = testInitSim()
    if test then
        -- reset simulation vars
        setAttr("RENDERER", "CURRENT", "shouldInit", 0, {0})

        currentTime = 0;
        frameTime = 0;
        setAttr("RENDERER", "CURRENT", "simTime", 0, {0})
    end

    return test
end


-----------------------------------------------
-- Simulation: timestep and texture swap management

isSimRunning = function()
	local simRunning = {}
	getAttr("RENDERER", "CURRENT", "simRunning", 0, simRunning)
    return simRunning[1] ~= 0
end

swapActiveTexture = function()
    local activeTex = {}
    getAttr("RENDERER", "CURRENT", "activeTex", 0, activeTex)
    if (activeTex[1] == 1) then
        setAttr("RENDERER", "CURRENT", "activeTex", 0, {2})
    elseif (activeTex[1] == 2) then
        setAttr("RENDERER", "CURRENT", "activeTex", 0, {1})
    end
end

steps = 0;

-- executed before solver step, sets frameTime
setFrameTime = function()
    if isSimRunning() then
        
        local newTime = {0}
        getAttr("RENDERER", "CURRENT", "TIMER", 0, newTime)

        if currentTime ~= 0 then
            frameTime = (newTime[1] - currentTime) / 1000 -- from ms to s
        end
        -- print("SET, frame time: ", string.format("%.3f", frameTime), "current time: ", currentTime, "newTime: ", newTime[1])

        currentTime = newTime[1]

        steps = 0
    else
        currentTime = 0
    end
end

-- executed at each solver step, swaps texture and sets timestep
-- matches dt to frame duration up to a maxDt
-- if TEST_MODE="RUN_WHILE": iterates until frameTime is 0
-- if TEST_MODE="RUN_IF": only one iteration, so if frameTime > maxDt, simulation is slower than real time
testSolverStep = function()
    if isSimRunning() and frameTime > 0 then
            swapActiveTexture()
    
            -- set dt
            local maxDt = {0}
            getAttr("RENDERER", "CURRENT", "maxDt", 0, maxDt)
    
            -- divides frame time over number of frames required
            local div = math.ceil(frameTime / maxDt[1])
            local dt = frameTime / div
            --local dt = maxDt[1]

            --local dt = math.min(frameTime, maxDt[1])

            -- print("STEP")
            -- print("frame time:       ", string.format("%.3f", frameTime), ", maxDt: ", string.format("%.3f", maxDt[1]))
            -- print("dt for this step: ", string.format("%.3f", dt), ", remaining steps: ", string.format("%d", div-1))

            setAttr("RENDERER", "CURRENT", "dt", 0, {dt})
            frameTime = frameTime - dt
    
            -- update simTime
            local simTime = {0}
            getAttr("RENDERER", "CURRENT", "simTime", 0, simTime)
            simTime[1] = simTime[1] + dt
            setAttr("RENDERER", "CURRENT", "simTime", 0, simTime)
            
            return true
        end

    return false
end


-----------------------------------------------
-- Passes enabled
waterEnabled = function()
	local enabled = {}
	getAttr("RENDERER", "CURRENT", "waterEnabled", 0, enabled)
    return enabled[1] ~= 0
end

waterSidesEnabled = function()
	local waterEnabled = {}
    local boxEnabled = {}
	getAttr("RENDERER", "CURRENT", "waterEnabled", 0, waterEnabled)
    getAttr("RENDERER", "CURRENT", "boxEnabled", 0, boxEnabled)
    return waterEnabled[1] ~= 0 and boxEnabled[1] == 0
end

boxEnabled = function()
	local enabled = {}
	getAttr("RENDERER", "CURRENT", "boxEnabled", 0, enabled)
    return enabled[1] ~= 0
end

terrainEnabled = function()
	local enabled = {}
	getAttr("RENDERER", "CURRENT", "terrainEnabled", 0, enabled)
    return enabled[1] ~= 0
end

skyboxEnabled = function()
	local enabled = {}
	getAttr("RENDERER", "CURRENT", "skyboxEnabled", 0, enabled)
    return enabled[1] ~= 0
end

causticsEnabled = function()
	local enabled = {}
	getAttr("RENDERER", "CURRENT", "causticsEnabled", 0, enabled)
    return enabled[1] ~= 0
end

aproxLightPathEnabled = function()
	local enabled1 = {}
    local enabled2 = {}
	getAttr("RENDERER", "CURRENT", "causticsEnabled", 0, enabled1)
    getAttr("RENDERER", "CURRENT", "aproxLightPath", 0, enabled2)
    return enabled1[1] ~= 0 and enabled2[1] == 0
end

perlinNoiseEnabled = function()
	local mode = {}
	getAttr("RENDERER", "CURRENT", "noiseMode", 0, mode)
    return mode[1] == 1
end

cellularNoiseEnabled = function()
	local mode = {}
	getAttr("RENDERER", "CURRENT", "noiseMode", 0, mode)
    return mode[1] == 2
end

-----------------------------------------------
-- DEBUG

-- waits n seconds
function wait()
    local n = 0
    local t0 = os.clock()
    while os.clock() - t0 <= n do end
end

printActiveTex = function(text)
    local activeTex = {}
    getAttr("RENDERER", "CURRENT", "activeTex", 0, activeTex)
    print(text, activeTex[1])
end