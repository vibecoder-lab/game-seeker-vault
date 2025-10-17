import React from 'react';
import { t, currentLocale, setLocale } from '../i18n/index.js';
import { dbHelper } from '../db/index.js';
import { getLocalizedFolderName } from '../utils/format.js';

export function Header({
  theme,
  currentTheme,
  setCurrentTheme,
  isScrolled,
  showMobileFilterModal,
  setShowMobileFilterModal,
  handleCloseMobileFilterModal,
  showMobileGenreModal,
  setShowMobileGenreModal,
  handleCloseMobileGenreModal,
  showHelpModal,
  setShowHelpModal,
  folders,
  targetFolderId,
  setTargetFolderId,
  showFolderDropdown,
  setShowFolderDropdown,
  shiftPressedForDelete,
  isHoveringDeleteButton,
  setIsHoveringDeleteButton,
  setFolders,
  setCollectionMap,
  setSelectedFolderId,
  showCollectionModal,
  setShowCollectionModal,
  showImportExportModal,
  setShowImportExportModal,
  showSettingsModal,
  setShowSettingsModal,
  setForceUpdate,
  settings,
  setSettings
}) {
  return (
    <header className={`md:fixed top-0 left-0 right-0 z-30 ${theme.bg} px-6 py-4 transition-shadow duration-100 ${isScrolled ? 'md:shadow-md' : ''}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-end md:gap-3">
          <div>
            <style>{`
              @keyframes gradient-move {
                0%   { background-position:   0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position:   0% 50%; }
              }
            `}</style>
            <h1 className="text-xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500 bg-[length:200%_200%] [animation:gradient-move_6s_ease-in-out_infinite]">
              {t('header.title', currentLocale)}
            </h1>
          </div>
        </div>


        <div className="hidden md:flex items-center gap-3">
          <div className="relative" onMouseLeave={() => setShowFolderDropdown(false)}>
            <button
              onClick={() => setShowFolderDropdown(!showFolderDropdown)}
              className={`px-3 py-2 rounded-lg ${theme.cardShadow} hover:scale-105 transition-all ${theme.buttonBg} text-sm flex items-center gap-2`}
              title={t('header.folder.tooltip', currentLocale)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="max-w-[160px] truncate">
                {getLocalizedFolderName(folders.find(f => f.id === targetFolderId)?.name, currentLocale) || t('header.folder.label', currentLocale)}
              </span>
            </button>
            {showFolderDropdown && (
              <div className={`absolute top-full left-1/2 -translate-x-1/2 ${theme.cardBg} ${theme.text} ${theme.cardShadow} rounded-lg overflow-hidden z-50 min-w-[160px] max-h-[200px] overflow-y-auto`}>
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setTargetFolderId(folder.id);
                      setShowFolderDropdown(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap ${targetFolderId === folder.id ? theme.folderSelected : theme.modalHover}`}
                  >
                    {getLocalizedFolderName(folder.name, currentLocale)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onMouseEnter={() => setIsHoveringDeleteButton(true)}
            onMouseLeave={() => setIsHoveringDeleteButton(false)}
            onClick={async () => {
              if (shiftPressedForDelete && isHoveringDeleteButton) {
                if (confirm(t('header.collection.deleteConfirm', currentLocale))) {
                  try {
                    await dbHelper.deleteAllData();
                    setFolders([]);
                    setCollectionMap({});
                    setSelectedFolderId(null);
                    setTargetFolderId(null);
                    window.location.reload();
                  } catch (error) {
                    console.error('Data deletion error:', error);
                    alert(t('header.collection.deleteError', currentLocale));
                  }
                }
              } else {
                setShowCollectionModal(!showCollectionModal);
              }
            }}
            className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showCollectionModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
            title={shiftPressedForDelete && isHoveringDeleteButton ? t('header.collection.deleteTooltip', currentLocale) : t('header.collection.tooltip', currentLocale)}
            style={showCollectionModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity duration-100 ${shiftPressedForDelete && isHoveringDeleteButton ? 'opacity-0' : 'opacity-100'}`} viewBox="0 0 24 24" fill="currentColor" style={showCollectionModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-opacity duration-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${shiftPressedForDelete && isHoveringDeleteButton ? 'opacity-100' : 'opacity-0'}`} viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => setShowImportExportModal(true)}
            className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showImportExportModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
            style={showImportExportModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
            title={t('header.importExport.tooltip', currentLocale)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showImportExportModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
              <path d="M11.47 1.72a.75.75 0 011.06 0l3 3a.75.75 0 01-1.06 1.06l-1.72-1.72V7.5h-1.5V4.06L9.53 5.78a.75.75 0 01-1.06-1.06l3-3zM11.25 7.5V15a.75.75 0 001.5 0V7.5h3.75a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9a3 3 0 013-3h3.75z"/>
              <path d="M12 16.5a.75.75 0 01.75.75v3.44l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V17.25a.75.75 0 01.75-.75z" opacity="0.6"/>
            </svg>
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showHelpModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
            style={showHelpModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
            title={t('header.help.tooltip', currentLocale)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showHelpModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
              <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all relative ${showSettingsModal ? (currentTheme === 'steam' ? 'steam-blue-bg text-white' : `${theme.text}`) : `${theme.buttonBg}`}`}
            style={showSettingsModal && currentTheme !== 'steam' ? {backgroundColor: 'currentColor', transition: 'background-color 0.1s ease, color 0.1s ease'} : {transition: 'background-color 0.1s ease, color 0.1s ease'}}
            title={t('header.settings.tooltip', currentLocale)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-colors duration-100" viewBox="0 0 24 24" fill="currentColor" style={showSettingsModal && currentTheme !== 'steam' ? {color: theme.buttonBg.includes('bg-gray-100') ? '#f3f4f6' : '#475569'} : {}}>
              <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.570.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => {
              const newLocale = currentLocale === 'en' ? 'ja' : 'en';
              setLocale(newLocale);
              setForceUpdate(prev => prev + 1);
            }}
            className={`p-2 rounded-lg ${theme.cardShadow} hover:scale-110 transition-all ${theme.buttonBg}`}
            title={t('header.language.tooltip', currentLocale)}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <span className="text-sm font-bold leading-none">
                {currentLocale.toUpperCase()}
              </span>
            </div>
          </button>
          <div className={`inline-flex rounded-xl ${theme.buttonBg} p-1`}>
            <button
              onClick={async ()=>{
                setCurrentTheme('default');
                if (settings.saveTheme) {
                  const newSettings = { ...settings, theme: 'default' };
                  setSettings(newSettings);
                  await dbHelper.saveSettings(newSettings);
                }
              }}
              className={`p-2 rounded-lg transition-all duration-100 ${currentTheme==='default'?theme.buttonActive:''}`}
              title={t('theme.default.tooltip', currentLocale)}
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
            </svg>
          </button>
          <button
            onClick={async ()=>{
              setCurrentTheme('steam');
              if (settings.saveTheme) {
                const newSettings = { ...settings, theme: 'steam' };
                setSettings(newSettings);
                await dbHelper.saveSettings(newSettings);
              }
            }}
            className={`p-2 rounded-lg transition-all duration-100 ${currentTheme==='steam'?theme.buttonActive:''}`}
            title={t('theme.dark.tooltip', currentLocale)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </header>
  );
}
