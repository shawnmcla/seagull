#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <assert.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE // nil
#endif

#define RGBA_WHITE 0xFFFFFFFF;
#define RGBA_BLACK 0x000000FF;

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
	return grid[(y)*gridWidth + (x - 1)] +
		   grid[(y)*gridWidth + (x + 1)] +

		   grid[(y - 1) * gridWidth + (x - 1)] +
		   grid[(y - 1) * gridWidth + (x)] +
		   grid[(y - 1) * gridWidth + (x + 1)] +

		   grid[(y + 1) * gridWidth + (x - 1)] +
		   grid[(y + 1) * gridWidth + (x)] +
		   grid[(y + 1) * gridWidth + (x + 1)];
}

EMSCRIPTEN_KEEPALIVE
uint8_t *getCurrentGrid()
{
	return current;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *getBitmap()
{
	return (uint8_t *)bitmap;
}

EMSCRIPTEN_KEEPALIVE
int getGridWidth()
{
	return gridWidth;
}

EMSCRIPTEN_KEEPALIVE
int getGridHeight()
{
	return gridHeight;
}

EMSCRIPTEN_KEEPALIVE
unsigned long getGeneration()
{
	return generation;
}

EMSCRIPTEN_KEEPALIVE
void setGeneration(int newGeneration)
{
	generation = newGeneration;
}


EMSCRIPTEN_KEEPALIVE
void updateBitmap()
{
	for (int y = 1; y < gridHeight - 1; y++)
	{
		for (int x = 1; x < gridWidth - 1; x++)
		{
			int index = (y - 1) * (gridWidth - 2) + (x - 1);
			int cell = current[y * gridWidth + x];
			if (cell == 1)
			{
				bitmap[index] = 0xFF000000;
				// bitmap[index+1] = 0x00;
				// bitmap[index+2] = 0x00;
				// bitmap[index+3] = 0xFF;
			}
			else
			{
				bitmap[index] = 0xFFFFFFFF;
				// bitmap[index+1] = 0xFF;
				// bitmap[index+2] = 0xFF;
				// bitmap[index+3] = 0xFF;
			}
		}
	}
}

EMSCRIPTEN_KEEPALIVE
void showGrid()
{
	for (int y = 1; y < gridHeight - 1; ++y)
	{
		for (int x = 1; x < gridWidth - 1; ++x)
		{
			uint8_t cell = current[y * gridWidth + x];
			if (cell == 1)
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
void step()
{
	for (int y = 1; y < gridHeight - 1; ++y)
	{
		for (int x = 1; x < gridWidth - 1; ++x)
		{
			int liveNeigbours = countLiveNeighbours(current, x, y);

			if (liveNeigbours == 3 || liveNeigbours == 2 && current[y * gridWidth + x] == 1)
			{
				previous[y * gridWidth + x] = 1;
			}
			else
			{
				previous[y * gridWidth + x] = 0;
			}
		}
	}

	tmp = current;
	current = previous;
	previous = tmp;
	updateBitmap();
	generation++;
}

void populateGrid(uint8_t *grid)
{
	for (int y = 1; y < gridHeight - 1; ++y)
	{
		for (int x = 1; x < gridWidth - 1; ++x)
		{
			if ((x + y) % 2 == 0)
				current[y * gridWidth + x] = 1;
			else
				current[y * gridWidth + x] = 0;
		}
	}
	// SET_CELL(grid, 3, 3, 1);
	// SET_CELL(grid, 4, 4, 1);
	// SET_CELL(grid, 2, 5, 1);
	// SET_CELL(grid, 3, 5, 1);
	// SET_CELL(grid, 4, 5, 1);
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

	populateGrid(grid1);
	updateBitmap();

	return 1;
}

EMSCRIPTEN_KEEPALIVE
void cleanup()
{
	free(grid1);
	free(grid2);
}

#ifndef __EMSCRIPTEN__
int main()
{
	printf("Hello, world\n");

	int initResult = init(32, 24);
	printf("Init: %d\n", initResult);

	return 0;
}
#endif