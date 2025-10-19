// Get store link for game
export const linkFor = (g) => {
  return g.storeUrl ? g.storeUrl : `https://store.steampowered.com/search/?term=${encodeURIComponent(g.title)}`;
};

// Extract app ID from Steam URL
export const appIdFromUrl = (url) => {
  const m = url?.match(/\/app\/(\d+)\//);
  return m ? m[1] : null;
};

// Get Steam capsule image URL
export const steamCapsuleUrl = (g) => {
  // Use imageUrl if available and valid (for new games)
  if (g.imageUrl && g.imageUrl !== '-') return g.imageUrl;
  // Otherwise generate URL the traditional way (for old games)
  const id = appIdFromUrl(g.storeUrl);
  return id ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${id}/capsule_616x353.jpg` : null;
};
