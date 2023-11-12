#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <assert.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#define RGBA_ON 0xFFFFFFFF
#define RGBA_OFF 0xFF000000

#define ON_STATE_VALUE 100

static uint8_t *grid1 = NULL;
static uint8_t *grid2 = NULL;
static uint8_t *current = NULL;
static uint8_t *previous = NULL;
static uint8_t *tmp = NULL;
static uint32_t *bitmap = NULL;

unsigned long generation = 0;
static unsigned gridWidth = 0;
static unsigned gridHeight = 0;

int countLiveNeighbours(uint8_t *grid, int x, int y)
{
	return (grid[(y)*gridWidth + (x - 1)] == ON_STATE_VALUE) +
		   (grid[(y)*gridWidth + (x + 1)] == ON_STATE_VALUE) +
		   (grid[(y - 1) * gridWidth + (x - 1)] == ON_STATE_VALUE) +
		   (grid[(y - 1) * gridWidth + (x)] == ON_STATE_VALUE) +
		   (grid[(y - 1) * gridWidth + (x + 1)] == ON_STATE_VALUE) +
		   (grid[(y + 1) * gridWidth + (x - 1)] == ON_STATE_VALUE) +
		   (grid[(y + 1) * gridWidth + (x)] == ON_STATE_VALUE) +
		   (grid[(y + 1) * gridWidth + (x + 1)] == ON_STATE_VALUE);
}

EMSCRIPTEN_KEEPALIVE
void updateBitmap(void)
{
	for (unsigned y = 1; y < gridHeight - 1; y++)
	{
		for (unsigned x = 1; x < gridWidth - 1; x++)
		{
			
			int index = (y - 1) * (gridWidth - 2) + (x - 1);
			int cell = current[y * gridWidth + x];
			uint8_t alpha = cell * 255 / ON_STATE_VALUE;
			bitmap[index] = (alpha << 24) | 0xFFFFFF;
		}
	}
}

EMSCRIPTEN_KEEPALIVE
uint8_t *getCurrentGrid(void)
{
	return current;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *getBitmap(void)
{
	return (uint8_t *)bitmap;
}

EMSCRIPTEN_KEEPALIVE
int getGridWidth(void)
{
	return gridWidth;
}

EMSCRIPTEN_KEEPALIVE
int getGridHeight(void)
{
	return gridHeight;
}

EMSCRIPTEN_KEEPALIVE
unsigned long getGeneration(void)
{
	return generation;
}

EMSCRIPTEN_KEEPALIVE
void setGeneration(int newGeneration)
{
	generation = newGeneration;
}

EMSCRIPTEN_KEEPALIVE
void setCell(int x, int y, int value)
{
	current[y * gridWidth + x] = value;
	updateBitmap();
}

EMSCRIPTEN_KEEPALIVE
uint8_t getCell(int x, int y)
{
	return current[y * gridWidth + x];
}

EMSCRIPTEN_KEEPALIVE
void showGrid(void)
{
	for (unsigned y = 1; y < gridHeight - 1; ++y)
	{
		for (unsigned x = 1; x < gridWidth - 1; ++x)
		{
			uint8_t cell = current[y * gridWidth + x];
			if (cell == ON_STATE_VALUE)
			{
				printf("X");
			}
			else
			{
				printf(".");
			}
		}

		printf("\n");
	}
}

EMSCRIPTEN_KEEPALIVE
void step(unsigned count)
{
	for (size_t i = 0; i < count; i++)
	{
		generation++;
		for (unsigned y = 1; y < gridHeight - 1; ++y)
		{
			for (unsigned x = 1; x < gridWidth - 1; ++x)
			{
				int liveNeigbours = countLiveNeighbours(current, x, y);

				uint8_t currentCell = current[y * gridWidth + x];

				if (liveNeigbours == 3 || (liveNeigbours == 2 && currentCell == ON_STATE_VALUE))
				{
					previous[y * gridWidth + x] = ON_STATE_VALUE;
				}
				else if (currentCell == ON_STATE_VALUE){
					previous[y * gridWidth + x] = currentCell / 2;
				}
				else if (currentCell >= 1)
				{
					previous[y * gridWidth + x] = currentCell - 1;
				}
				else {
					previous[y * gridWidth + x] = 0;
				}
			}
		}

		tmp = current;
		current = previous;
		previous = tmp;
	}

	updateBitmap();
}

void populateGrid(uint8_t *grid)
{
	for (unsigned y = 1; y < gridHeight - 1; ++y)
	{
		for (unsigned x = 1; x < gridWidth - 1; ++x)
		{
			if ((x + y) % 2 == 0)
				grid[y * gridWidth + x] = ON_STATE_VALUE;
			else
				grid[y * gridWidth + x] = 0;
		}
	}

	// grid[ (1) * gridWidth + (3) ] = ON_STATE_VALUE;
	// grid[ (2) * gridWidth + (4) ] = ON_STATE_VALUE;
	// grid[ (3) * gridWidth + (2) ] = ON_STATE_VALUE;
	// grid[ (3) * gridWidth + (3) ] = ON_STATE_VALUE;
	// grid[ (3) * gridWidth + (4) ] = ON_STATE_VALUE;
}

EMSCRIPTEN_KEEPALIVE
int init(unsigned width, unsigned height)
{
	generation = 0;

	gridWidth = width;
	gridHeight = height;

	if (gridWidth * gridHeight > 5000000)
	{
		printf("Arbitrary limit of 5000000 bytes for grid exceeded :)\n");
		return -1;
	}

	int gridSize = width * height * sizeof(uint8_t);
	int bitmapSize = (width - 2) * (height - 2) * sizeof(uint32_t);

	printf("INFO: Initializing with dimensions: %u x %u (grid size = %d bytes | bitmap size = %d bytes)\n", gridWidth, gridHeight, gridSize, bitmapSize);

	grid1 = realloc(grid1, gridSize);
	if (grid1 == NULL)
	{
		printf("realloc failed for grid1\n");
		return -1;
	}

	grid2 = realloc(grid2, gridSize);
	if (grid2 == NULL)
	{
		printf("realloc failed for grid1\n");
		return -1;
	}

	bitmap = realloc(bitmap, bitmapSize);
	if (bitmap == NULL)
	{
		printf("realloc failed for bitmap\n");
		return -1;
	}

	memset(grid1, 0, gridSize);
	memset(grid2, 0, gridSize);
	memset(bitmap, 0, bitmapSize);

	current = grid1;
	previous = grid2;

	updateBitmap();

	return 1;
}

EMSCRIPTEN_KEEPALIVE
void cleanup(void)
{
	free(grid1);
	free(grid2);
}

#ifndef __EMSCRIPTEN__
int main(void)
{
	// 	printf("MAIN CALLED\n");
	// 	init(10, 10);

	// for(int i = 0; i < 1000000; i++){
	// 	showGrid();
	// 	getchar();
	// 	step(1);
	// }
	return 0;
}
#endif
