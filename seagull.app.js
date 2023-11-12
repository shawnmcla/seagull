import Module from './seagull.js';

const INITIAL_GRID_WIDTH = 100;
const INITIAL_GRID_HEIGHT = 100;
const INITIAL_STEPS_PER_SECOND = 60;
const ON_STATE_VALUE = 100;

class StateSeeder {
    getGrid(module) {
        const gridWidth = module._getGridWidth();
        const gridHeight = module._getGridHeight();
        const gridSize = gridWidth * gridHeight;
        const gridOffset = module._getCurrentGrid();

        return {
            width: gridWidth,
            height: gridHeight,
            size: gridSize,
            offset: gridOffset
        }
    }

    apply() { throw new Error("Unimplemented"); }
}

class EmptyStateSeeder extends StateSeeder {
    apply(module) {
        const grid = this.getGrid(module);
        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);
        for (let i = 0; i < grid.size; i++) {
            arr[i] = 0;
        }
    }
}

class RandomStateSeeder extends StateSeeder {
    constructor(liveRate = 0.5) {
        super();
        this.liveRate = liveRate;
    }

    apply(module) {
        const grid = this.getGrid(module);
        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);

        for (let i = 0; i < grid.size; i++) {
            arr[i] = 0;
        }

        for (let y = 1; y < grid.height - 1; y++) {
            for (let x = 1; x < grid.width - 1; x++) {
                arr[y * grid.width + x] = Math.random() >= (1 - this.liveRate) ? ON_STATE_VALUE : 0;
            }
        }
    }
}

class EvenStateSeeder extends StateSeeder {
    apply(module) {
        const grid = this.getGrid(module);
        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);

        for (let i = 0; i < grid.size; i++) {
            arr[i] = 0;
        }

        for (let y = 1; y < grid.height - 1; y++) {
            for (let x = 1; x < grid.width - 1; x++) {
                arr[y * grid.width + x] = ((x + y) % 2 == 0) ? ON_STATE_VALUE : 0;
            }
        }
    }
}

class GliderStateSeeder extends StateSeeder {
    apply(module) {
        const grid = this.getGrid(module);
        if (grid.width < 4 || grid.height < 4) throw new Error("Glider requires at least a 3x3 grid");

        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);

        for (let i = 0; i < grid.size; i++) {
            arr[i] = 0;
        }

        arr[1 * grid.width + 3] = ON_STATE_VALUE;

        arr[2 * grid.width + 4] = ON_STATE_VALUE;

        arr[3 * grid.width + 2] = ON_STATE_VALUE;
        arr[3 * grid.width + 3] = ON_STATE_VALUE;
        arr[3 * grid.width + 4] = ON_STATE_VALUE;
    }
}


class Seagull {
    _bitmapOffset;
    _bitmapArrLength;
    _bitmapArray;
    _imageData;
    _running = false;
    _runStepCallback = null;
    _minStepInterval;
    _lastStepTs = 0;

    width;
    height;

    constructor(module, canvas, width = INITIAL_GRID_WIDTH, height = INITIAL_GRID_HEIGHT) {
        if (!module) throw "Module is required";

        this.module = module;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');

        this.setMaxStepsPerSecond(INITIAL_STEPS_PER_SECOND);
        this.setSize(width, height);
    }

    setSize(newWidth, newHeight) {
        if (newWidth == this.width && newHeight == this.height) return;

        this.ratio = newWidth / newHeight;

        this.canvas.width = newWidth;
        this.canvas.height = newHeight;

        this.canvas.style.aspectRatio = this.ratio;

        this.width = newWidth + 2;
        this.height = newHeight + 2;

        this.initialize(0.1, false);
    }

    get generation() {
        return this.module._getGeneration();
    }

    setMaxStepsPerSecond(maxSteps) {
        this.maxStepsPerSecond = maxSteps;
        this._minStepInterval = 1000 / maxSteps;
    }

    applyStateSeeder(seeder) {
        seeder.apply(this.module);
        this.module._setGeneration(0);
        this.module._updateBitmap();
        this.draw();
    }

    setCell(x, y, state) {
        this.module._setCell(x + 1, y + 1, state);
    }

    run(callback = null) {
        if (this._running) return;
        this._runStepCallback = callback;
        this._running = true;
        this._runStep();
    }

    stop() {
        this._running = false;
        this._runStepCallback = null;
    }

    initialize() {
        const result = this.module._init(this.width, this.height);
        if (result < 0) throw new Error(`Initialization failed with error code ${result}`);

        this._bitmapOffset = this.module._getBitmap();
        this._bitmapArrLength = (this.width - 2) * (this.height - 2) * 4;
        this._bitmapArray = new Uint8ClampedArray(this.module.HEAPU8.subarray(0, 1).buffer, this._bitmapOffset, this._bitmapArrLength);
        this._imageData = new ImageData(this._bitmapArray, this.width - 2, this.height - 2);

        this.draw();
    }

    step() {
        this.module._step(1);
        this.ctx.putImageData(this._imageData, 0, 0);
    }

    stepMany(count) {
        if (typeof count !== 'number' || count < 0 || count > 1000) throw new Error("Invalid count for steps: " + count);
        this.module._step(count);
        this.ctx.putImageData(this._imageData, 0, 0);
    }

    draw() {
        this.ctx.putImageData(this._imageData, 0, 0);
    }

    stepNoDraw() {
        this.module._step(1);
    }

    _runStep(ts = 0) {
        if (!this._running) return;

        if (ts - this._lastStepTs >= this._minStepInterval) {
            this._iteration += 1;

            if (this._iteration >= 10) {
                this._iteration = 0;
                this._chaosSeeder.apply(this.module);
            }

            this._lastStepTs = ts;
            this.step();
            this._runStepCallback();
        }

        requestAnimationFrame(this._runStep.bind(this));
    }
}

class SeagullUI {
    constructor(seagullInstance) {
        if (!seagullInstance) throw new Error("Seagull instance is required");

        this.instance = seagullInstance;

        this.buttonRun = document.querySelector('#btnRun');
        this.buttonStep = document.querySelector('#btnStep');
        this.buttonStep10 = document.querySelector('#btnStep10');
        this.buttonStep10 = document.querySelector('#btnStep100');

        this.selectSeedStates = document.querySelector('#selectSeedStates');
        this.buttonUseSeedState = document.querySelector('#btnUseSeedState');

        this.infoGenerationCount = document.querySelector("#infoGenerationCount");
        this.infoGridWidth = document.querySelector("#infoGridWidth");
        this.infoGridHeight = document.querySelector("#infoGridHeight");

        this.numberMaxStepsPerSecond = document.querySelector("#numMaxStepsPerSecond");
        this.numberGridDisplayWidth = document.querySelector("#numGridDisplayWidth");

        this.canvas = this.instance.canvas;
        this.canvas.addEventListener('click', (e) => {
            const mx = Math.max(e.offsetX, 0);
            const my = Math.max(e.offsetY, 0);
            const cellDimensions = this.canvas.offsetWidth / this.canvas.width;
            const gx = Math.floor(mx / cellDimensions);
            const gy = Math.floor(my / cellDimensions);
            console.log(`Toggling cell at (${gx}, ${gy})`);
            this.instance.setCell(gx, gy, 1);

            this.instance.draw();
        });

        this.buttonRun.addEventListener('click', () => {
            if (this.instance._running) {
                this.instance.stop();
                this.buttonRun.textContent = "Run";
            } else {
                this.instance.run(() => this.updateUiInfo());
                this.buttonRun.textContent = "Stop";
            }
        });

        this.buttonStep.addEventListener('click', () => {
            this.instance.step();
            this.updateUiInfo();
        });

        this.buttonStep10.addEventListener('click', () => {
            this.instance.stepMany(10);
            this.updateUiInfo();
        });

        this.buttonStep10.addEventListener('click', () => {
            this.instance.stepMany(100);
            this.updateUiInfo();
        });

        this.buttonUseSeedState.addEventListener('click', () => {
            const seedType = this.selectSeedStates.value;

            switch (seedType) {
                case "EMPTY":
                    this.instance.applyStateSeeder(new EmptyStateSeeder());
                    break;
                case "RANDOM":
                    this.instance.applyStateSeeder(new RandomStateSeeder(0.1));
                    break;
                case "GLIDER":
                    this.instance.applyStateSeeder(new GliderStateSeeder());
                    break;
                case "EVEN":
                    this.instance.applyStateSeeder(new EvenStateSeeder());
                    break;
                default:
                    throw "TODO";
            }

            this.updateUiInfo();
        });

        this.numberMaxStepsPerSecond.addEventListener('input', () => {
            const newValue = parseInt(this.numberMaxStepsPerSecond.value);
            if (Number.isNaN(newValue)) return;
            this.instance.setMaxStepsPerSecond(newValue);
        });

        this.numberGridDisplayWidth.addEventListener('input', () => {
            const newValue = parseInt(this.numberGridDisplayWidth.value);
            if (Number.isNaN(newValue)) return;
            this.instance.canvas.style.width = `${newValue}px`;
        });

        this.updateUiInfo();
    }

    updateUiInfo() {
        this.infoGenerationCount.textContent = this.instance.generation;
        this.infoGridWidth.textContent = this.instance.width - 2;
        this.infoGridHeight.textContent = this.instance.height - 2;
    }
}

Module().then((module) => {
    const canvas = document.querySelector('canvas');
    const instance = new Seagull(module, canvas);
    const ui = new SeagullUI(instance);

    window.instance = instance;
});