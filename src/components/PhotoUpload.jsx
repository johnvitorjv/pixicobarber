import { useState, useRef } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';

// ═══════════════════════════════════════════════
// PIXICO BARBER — Componente de Upload de Foto Premium
// Converte imagem em base64 e armazena no localStorage
// ═══════════════════════════════════════════════

const MAX_SIZE_MB = 2;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * PhotoUpload — componente reutilizável para upload de foto de perfil.
 * @param {string} value - URL base64 atual da foto
 * @param {function} onChange - callback com a nova base64 string
 * @param {string} initials - iniciais do usuário (fallback)
 * @param {boolean} required - se é obrigatório
 * @param {string} error - mensagem de erro
 * @param {string} size - 'sm' | 'md' | 'lg'
 */
export default function PhotoUpload({ value, onChange, initials = '', required = false, error = '', size = 'md' }) {
    const [preview, setPreview] = useState(value || '');
    const [fileError, setFileError] = useState('');
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);

    const sizes = {
        sm: { container: 'w-16 h-16', icon: 16, text: 'text-xs' },
        md: { container: 'w-24 h-24', icon: 24, text: 'text-sm' },
        lg: { container: 'w-32 h-32', icon: 32, text: 'text-base' },
    };
    const s = sizes[size] || sizes.md;

    function processFile(file) {
        setFileError('');

        if (!ACCEPTED_TYPES.includes(file.type)) {
            setFileError('Formato inválido. Use JPG, PNG ou WebP.');
            return;
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            setFileError(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
            return;
        }

        // Redimensionar e converter para base64
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 300;
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else { w = Math.round(w * MAX / h); h = MAX; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                setPreview(base64);
                onChange(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function handleFileChange(e) {
        const file = e.target.files[0];
        if (file) processFile(file);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }

    function handleRemove(e) {
        e.stopPropagation();
        setPreview('');
        onChange('');
        if (inputRef.current) inputRef.current.value = '';
    }

    const displayError = error || fileError;

    return (
        <div className="flex flex-col items-center gap-2">
            <div
                className={`${s.container} relative cursor-pointer group overflow-hidden border-2 transition-all duration-300 rounded-full ${displayError ? 'border-red-500/50' :
                        dragging ? 'border-primary scale-105' :
                            preview ? 'border-primary/30 hover:border-primary' :
                                'border-white/10 hover:border-primary/50'
                    }`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
            >
                {preview ? (
                    <>
                        <img src={preview} alt="Foto" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera size={s.icon} className="text-white" />
                        </div>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                            <X size={10} />
                        </button>
                    </>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-zinc-900/80">
                        {initials ? (
                            <span className={`font-display font-bold text-primary/40 ${s.text}`}>{initials}</span>
                        ) : (
                            <Camera size={s.icon} className="text-zinc-600" />
                        )}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(',')}
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {!preview && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                    {required ? 'Foto obrigatória' : 'Adicionar foto'}
                </span>
            )}

            {displayError && (
                <span className="text-[10px] text-red-400 font-modern text-center max-w-32">{displayError}</span>
            )}
        </div>
    );
}

/**
 * Avatar — componente de exibição de foto/iniciais.
 * @param {string} src - URL base64 da foto
 * @param {string} initials - iniciais (fallback)
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg'
 */
export function Avatar({ src, initials = '?', size = 'sm', className = '' }) {
    const sizes = {
        xs: 'w-6 h-6 text-[8px]',
        sm: 'w-9 h-9 text-xs',
        md: 'w-12 h-12 text-sm',
        lg: 'w-20 h-20 text-lg',
    };

    return (
        <div className={`${sizes[size] || sizes.sm} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
            {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-display font-bold">
                    {initials}
                </div>
            )}
        </div>
    );
}
