import Module from './seagull.js';

/**
 * TODO STUFF
 * - When obtaining offset and grid dimensions from WASM module,
 *   take into account that we're actually using width-2, height-2
 * 
 */

const INITIAL_GRID_WIDTH = 256;
const INITIAL_GRID_HEIGHT = 256;

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

    apply(module) { throw new Error("Unimplemented"); }
}

class EmptyStateSeeder extends StateSeeder {
    apply(module){
        const grid = this.getGrid(module);
        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);
        for(let i = 0; i < grid.size; i++){
            arr[i] = 0;
        }
    }
}

class RandomStateSeeder extends StateSeeder {
    constructor(liveRate = 0.5){
        super();
        this.liveRate = liveRate;
    }

    apply(module){
        const grid = this.getGrid(module);
        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);
        for(let i = 0; i < grid.size; i++){ // TODO this is inexact
            arr[i] = Math.random() >= (1 - this.liveRate);
        }
    }
}

class GliderStateSeeder extends StateSeeder {
    apply(module){
        const grid = this.getGrid(module);
        if(grid.width < 3 || grid.height < 3) throw new Error("Glider requires at least a 3x3 grid");

        const arr = new Uint8Array(module.HEAPU8.subarray(0, 1).buffer, grid.offset, grid.size);

        arr
    }
}


class Seagull {
    _bitmapOffset;
    _bitmapArrLength;
    _bitmapArray;
    _imageData;
    _running = false;
    _runStepCallback = null;

    constructor(module, canvas, width = INITIAL_GRID_WIDTH, height = INITIAL_GRID_HEIGHT) {
        if (!module) throw "Module is required";

        this.module = module;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.width = width;
        this.height = height;

        this.ratio = this.width / this.height;

        this.canvas.width = width;
        this.canvas.height = height;

        this.canvas.style.aspectRatio = this.ratio;
    }

    get generation() {
        return this.module._getGeneration();
    }

    applyStateSeeder(seeder){
        seeder.apply(this.module);
        this.module._setGeneration(0);
        this.module._updateBitmap();
        this.draw();
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
        this._bitmapArrLength = this.width * this.height * 4;
        this._bitmapArray = new Uint8ClampedArray(this.module.HEAPU8.subarray(0, 1).buffer, this._bitmapOffset, this._bitmapArrLength);
        this._imageData = new ImageData(this._bitmapArray, this.width, this.height);
    }

    step() {
        this.module._step();
        this.ctx.putImageData(this._imageData, 0, 0);
    }

    draw() {
        this.ctx.putImageData(this._imageData, 0, 0);
    }

    stepNoDraw() {
        this.module._step();
    }

    _runStep() {
        if (!this._running) return;

        this.step();
        this._runStepCallback();
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

        this.selectSeedStates = document.querySelector('#selectSeedStates');
        this.buttonUseSeedState = document.querySelector('#btnUseSeedState');

        this.generationCount = document.querySelector("#infoGenerationCount");

        this.buttonRun.addEventListener('click', () => {
            if (this.instance._running) {
                this.instance.stop();
                this.buttonRun.textContent = "Run";
            } else {
                this.instance.run(() => this.updateGenerationCount());
                this.buttonRun.textContent = "Stop";
            }
        });

        this.buttonStep.addEventListener('click', () => {
            this.instance.step();
            this.updateGenerationCount();
        });

        this.buttonStep10.addEventListener('click', () => {
            for (let i = 0; i < 9; i++) this.instance.stepNoDraw();
            this.instance.step();

            this.updateGenerationCount();
        });

        this.buttonUseSeedState.addEventListener('click', () => {
            const seedType = this.selectSeedStates.value;
            console.log("Will apply: ", seedType);

            switch(seedType){
                case "EMPTY":
                    this.instance.applyStateSeeder(new EmptyStateSeeder());
                    break;
                case "RANDOM":
                    this.instance.applyStateSeeder(new RandomStateSeeder(0.1));
                    break;
                default:
                    throw "TODO";
            }

            this.updateGenerationCount();
        });
    }

    updateGenerationCount() {
        this.generationCount.textContent = this.instance.generation;
    }
}

Module().then((module) => {
    const canvas = document.querySelector('canvas');
    const instance = new Seagull(module, canvas);
    const ui = new SeagullUI(instance);

    window.instance = instance;

    instance.initialize();
});