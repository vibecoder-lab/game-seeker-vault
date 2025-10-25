import React, { useState } from 'react';
import { t, currentLocale } from '../../i18n/index.js';

export function HelpModal({ theme, currentTheme, isClosing, onClose }) {
  const [activeTab, setActiveTab] = useState('disclaimer');

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${isClosing ? 'modal-fade-out' : 'modal-fade-in'}`} onClick={onClose}>
      <div className={`${theme.cardBg} rounded-2xl max-w-2xl w-full h-[80vh] flex flex-col ${theme.cardShadow}`} onClick={(e) => e.stopPropagation()}>
        <div className={`flex justify-between items-center px-4 py-3 border-b ${theme.border} h-[46px]`}>
          <h2 className="text-base font-bold">{t('help.title', currentLocale)}</h2>
          <button
            onClick={onClose}
            className={`p-1 rounded ${theme.modalHover}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className={`flex border-b ${theme.border}`}>
          <button
            onClick={() => setActiveTab('disclaimer')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'disclaimer'
                ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                : `${theme.subText} hover:${theme.text}`
            }`}
          >
            {t('help.tabDisclaimer', currentLocale)}
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'guide'
                ? `${theme.text} border-b-2 ${currentTheme === 'steam' ? 'border-blue-500' : 'border-current'}`
                : `${theme.subText} hover:${theme.text}`
            }`}
          >
            {t('help.tabGuide', currentLocale)}
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'disclaimer' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">{t('help.disclaimer.title', currentLocale)}</h3>
              <div className="space-y-3 text-sm">
                <p>
                  {t('help.disclaimer.intro1', currentLocale)}<br />
                  {t('help.disclaimer.intro2', currentLocale)}<br />
                  {t('help.disclaimer.intro3', currentLocale)}
                </p>

                <h4 className="font-bold mt-4">{t('help.disclaimer.priceInfo.title', currentLocale)}</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>{t('help.disclaimer.priceInfo.text1', currentLocale)}</li>
                  <li>{t('help.disclaimer.priceInfo.text2', currentLocale)}</li>
                  <li>{t('help.disclaimer.priceInfo.text3', currentLocale)}</li>
                </ul>

                <h4 className="font-bold mt-4">{t('help.disclaimer.dataAccuracy.title', currentLocale)}</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>{t('help.disclaimer.dataAccuracy.text1', currentLocale)}</li>
                  <li>{t('help.disclaimer.dataAccuracy.text2', currentLocale)}</li>
                  <li>{t('help.disclaimer.dataAccuracy.text3', currentLocale)}</li>
                  <li>{t('help.disclaimer.dataAccuracy.text4', currentLocale)}</li>
                </ul>

                <h4 className="font-bold mt-4">{t('help.disclaimer.liability.title', currentLocale)}</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>{t('help.disclaimer.liability.text1', currentLocale)}</li>
                  <li>{t('help.disclaimer.liability.text2', currentLocale)}</li>
                  <li>{t('help.disclaimer.liability.text3', currentLocale)}</li>
                </ul>

                <h4 className="font-bold mt-4">{t('help.disclaimer.curation.title', currentLocale)}</h4>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>{t('help.disclaimer.curation.text1', currentLocale)}</li>
                  <li>{t('help.disclaimer.curation.text2', currentLocale)}</li>
                  <li>{t('help.disclaimer.curation.text3', currentLocale)}</li>
                  <li>{t('help.disclaimer.curation.text4', currentLocale)}</li>
                  <li>{t('help.disclaimer.curation.text5', currentLocale)}</li>
                  <li>{t('help.disclaimer.curation.text6', currentLocale)}</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">{t('help.guide.title', currentLocale)}</h3>
              <div className="space-y-3 text-sm">
                <div className="md:hidden space-y-3">
                  <h4 className="font-bold">{t('help.guide.mobile.basic', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.mobile.basic1', currentLocale)}</li>
                    <li>{t('help.guide.mobile.basic2', currentLocale)}</li>
                    <li>{t('help.guide.mobile.basic3', currentLocale)}</li>
                    <li>{t('help.guide.mobile.basic4', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.mobile.basic4a', currentLocale)}</li>
                        <li>{t('help.guide.mobile.basic4b', currentLocale)}</li>
                        <li>{t('help.guide.mobile.basic4c', currentLocale)}</li>
                        <li>{t('help.guide.mobile.basic4d', currentLocale)}</li>
                        <li>{t('help.guide.mobile.basic4e', currentLocale)}</li>
                        <li>{t('help.guide.mobile.basic4f', currentLocale)}</li>
                      </ul>
                    </li>
                    <li>{t('help.guide.mobile.basic5', currentLocale)}</li>
                    <li>{t('help.guide.mobile.basic6', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.mobile.longTap', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.mobile.longTap1', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.mobile.longTap1a', currentLocale)}</li>
                      </ul>
                    </li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.mobile.pcOnly', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.mobile.pcOnly1', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.mobile.pcOnly1a', currentLocale)}</li>
                        <li>{t('help.guide.mobile.pcOnly1b', currentLocale)}</li>
                        <li>{t('help.guide.mobile.pcOnly1c', currentLocale)}</li>
                      </ul>
                    </li>
                  </ul>
                </div>
                <div className="hidden md:block space-y-3">
                  <h4 className="font-bold">{t('help.guide.pc.basic', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.basic1', currentLocale)}</li>
                    <li>{t('help.guide.pc.basic2', currentLocale)}</li>
                    <li>{t('help.guide.pc.basic3', currentLocale)}</li>
                    <li>{t('help.guide.pc.basic4', currentLocale)}</li>
                    <li>{t('help.guide.pc.basic5', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.pc.collection', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.collection1', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection2', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection3', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection4', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection5', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection6', currentLocale)}</li>
                    <li>{t('help.guide.pc.collection7', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.pc.collection7a', currentLocale)}</li>
                        <li>{t('help.guide.pc.collection7b', currentLocale)}</li>
                        <li>{t('help.guide.pc.collection7c', currentLocale)}</li>
                        <li>{t('help.guide.pc.collection7d', currentLocale)}</li>
                        <li>{t('help.guide.pc.collection7e', currentLocale)}</li>
                        <li>{t('help.guide.pc.collection7f', currentLocale)}</li>
                      </ul>
                    </li>
                    <li>{t('help.guide.pc.collection8', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.pc.exportImport', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.exportImport1', currentLocale)}</li>
                    <li>{t('help.guide.pc.exportImport2', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.pc.basicUsage', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.basicUsage1', currentLocale)}</li>
                    <li>{t('help.guide.pc.basicUsage2', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.pc.shortcuts', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.shortcuts1', currentLocale)}</li>
                    <li>{t('help.guide.pc.shortcuts2', currentLocale)}</li>
                  </ul>

                  <h4 className="font-bold mt-4">{t('help.guide.pc.shiftKey', currentLocale)}</h4>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('help.guide.pc.shiftKey1', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.pc.shiftKey1a', currentLocale)}</li>
                        <li>{t('help.guide.pc.shiftKey1b', currentLocale)}</li>
                      </ul>
                    </li>
                    <li>{t('help.guide.pc.shiftKey2', currentLocale)}
                      <ul className="list-disc list-inside space-y-1 ml-6 mt-1">
                        <li>{t('help.guide.pc.shiftKey2a', currentLocale)}</li>
                      </ul>
                    </li>
                    <li>{t('help.guide.pc.shiftKey3', currentLocale)}</li>
                    <li>{t('help.guide.pc.shiftKey4', currentLocale)}</li>
                    <li>{t('help.guide.pc.shiftKey5', currentLocale)}</li>
                    <li>{t('help.guide.pc.shiftKey6', currentLocale)}</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
