// components/LoginPrompt.tsx
import React from 'react';

const LoginPrompt: React.FC<{ onLoginClick: () => void }> = ({ onLoginClick }) => (
    <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-3">
        登入即同步雲端，下次開啟也能繼續編輯！
        <button onClick={onLoginClick} className="font-semibold text-blue-600 hover:underline ml-2">立即登入</button>
    </div>
);

export default LoginPrompt;
