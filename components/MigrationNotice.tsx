
import React from 'react';
import { ExternalLinkIcon } from './icons';

interface MigrationNoticeProps {
  newUrl: string;
}

const MigrationNotice: React.FC<MigrationNoticeProps> = ({ newUrl }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="mb-6 flex justify-center">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full animate-bounce">
            <ExternalLinkIcon className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          搬家囉！新版本已上線
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          為了提供更穩定的服務與更豐富的功能，<br />
          <span className="font-bold text-blue-600 dark:text-blue-400">SlotGrid</span> 已經搬遷至新網域。<br />
          舊版將不再維護，請立即前往新站繼續使用。
        </p>
        
        <a 
          href={newUrl}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-1 active:scale-95 mb-4"
        >
          立即前往新版 🚀
        </a>
        
        <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-500">
          建議將新網域加入書籤，方便下次使用
        </p>
      </div>
    </div>
  );
};

export default MigrationNotice;
