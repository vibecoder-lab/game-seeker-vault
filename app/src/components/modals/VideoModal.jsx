import React, { useState } from 'react';

export function VideoModal({ game, theme, isClosing, onClose }) {
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const hasMovies = game.movies && game.movies.length > 0;
  const hasScreenshots = game.screenshots && game.screenshots.length > 0;

  const currentMovie = hasMovies ? game.movies[selectedVideoIndex] : null;
  const currentScreenshot = hasScreenshots ? game.screenshots[selectedScreenshotIndex] : null;

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 ${isClosing ? 'modal-fade-out' : 'modal-fade-in'}`}
      onClick={onClose}
    >
      <div
        className={`${theme.cardBg} rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col ${theme.cardShadow}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex justify-between items-center px-4 border-b ${theme.border} h-[46px]`}>
          <h2 className="text-base font-bold">{game.title}</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded ${theme.modalHover}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Video Player or Screenshot Display */}
          <div className="relative">
            {hasMovies ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  key={currentMovie.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                  poster={currentMovie.thumbnail}
                >
                  <source src={currentMovie.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : hasScreenshots ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={currentScreenshot.full}
                  alt={`${game.title} screenshot ${selectedScreenshotIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <p className={theme.subText}>No media available</p>
              </div>
            )}

            {/* Thumbnail Hover Area and Overlay */}
            {hasMovies && game.movies.length > 1 && (
              <>
                {/* Transparent hover area on the right side */}
                <div
                  className="absolute top-0 right-0 h-full w-32"
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  {/* Movie Thumbnails Overlay */}
                  <div
                    className={`h-full w-full flex flex-col gap-2 p-2 overflow-y-auto transition-opacity duration-200 bg-black bg-opacity-50 rounded-r-lg ${
                      isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {game.movies.map((movie, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedVideoIndex(index)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                          selectedVideoIndex === index
                            ? 'border-blue-500'
                            : `border-transparent ${theme.modalHover}`
                        }`}
                      >
                        <img
                          src={movie.thumbnail}
                          alt={movie.name}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Screenshot List (when no movies) */}
          {!hasMovies && hasScreenshots && game.screenshots.length > 1 && (
            <div>
              <h3 className="text-sm font-bold mb-2">Screenshots ({game.screenshots.length})</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {game.screenshots.map((screenshot, index) => (
                  <button
                    key={screenshot.id}
                    onClick={() => setSelectedScreenshotIndex(index)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selectedScreenshotIndex === index
                        ? 'border-blue-500'
                        : `border-transparent ${theme.modalHover}`
                    }`}
                  >
                    <img
                      src={screenshot.thumbnail}
                      alt={`Screenshot ${index + 1}`}
                      className="w-full aspect-video object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
