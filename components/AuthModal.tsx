// components/AuthModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { GoogleIcon } from './icons';
import { auth, googleProvider } from '../firebaseClient';

// 由於 Firebase SDK 是透過 CDN 載入的，我們需要告訴 TypeScript 全域 `firebase` 物件的存在
// 以便我們能存取 `firebase.auth.Auth.Persistence.LOCAL` 這個常數。
declare const firebase: any;

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setEmail('');
            setPassword('');
        }
    }, [isOpen]);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // REVERTED: Switched back to signInWithPopup as signInWithRedirect is not supported
            // in the sandboxed environment, causing the "operation-not-supported" error.
            await auth.signInWithPopup(googleProvider);
            // On success, the onAuthStateChanged listener will fire and update the app state.
            // We can now close the modal.
            onClose();
        } catch (err: any) {
            // Add specific error handling for common popup issues.
            if (err.code === 'auth/popup-blocked') {
                setError("彈出視窗被瀏覽器攔截了。請在瀏覽器設定中，允許此網站的彈出視窗後再試一次。");
            } else if (err.code === 'auth/popup-closed-by-user') {
                // This isn't a true error; the user just closed the window.
                // No need to show a scary error message.
                console.log("Login popup closed by user.");
            } else if (err.code === 'auth/operation-not-supported-in-this-environment') {
                 setError("此瀏覽器環境不支援此登入方式，請嘗試其他瀏覽器或停用無痕模式。");
            } else {
                setError(err.message);
            }
            setIsLoading(false);
        }
        // Do not set isLoading to false on success, as the modal will be closing.
    };
    
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            // Set persistence for email auth
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            if (isRegistering) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const header = <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100" translate="no">{isRegistering ? '註冊帳號' : '登入'}</h2>;
    
    const footer = (
      <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {isLoading ? '處理中...' : (isRegistering ? '註冊' : '登入')}
      </button>
    );

    return (
        <form onSubmit={handleEmailAuth}>
            <Modal isOpen={isOpen} onClose={onClose} headerContent={header} footerContent={footer}>
                 {error && <p className="bg-red-100 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</p>}
                
                <div className="space-y-4">
                    <input type="email" placeholder="電子郵件" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
                    <input type="password" placeholder="密碼 (至少6位數)" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 transition bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
                </div>
                
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300 dark:border-gray-600"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">或</span></div>
                </div>

                <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2 disabled:opacity-50">
                    <GoogleIcon /> 使用 Google 登入
                </button>
                
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                    {isRegistering ? '已經有帳號了？' : '還沒有帳號？'}
                    <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="font-semibold text-blue-600 hover:underline ml-1">
                        {isRegistering ? '立即登入' : '立即註冊'}
                    </button>
                </p>
            </Modal>
        </form>
    );
};

export default AuthModal;