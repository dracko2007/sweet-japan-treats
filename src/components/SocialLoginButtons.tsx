import React from 'react';
import SocialLoginButton from './SocialLoginButton';
import PhoneLoginButton from './PhoneLoginButton';

/**
 * Bloco com todos os métodos de login alternativos: Google, Facebook,
 * Twitter/X e telefone (SMS). Usado nas telas de Login e Cadastro abaixo do
 * divisor "ou". Cada provedor só funciona depois de ativado no Firebase Console.
 */
const SocialLoginButtons: React.FC<{ disabled?: boolean; mode?: 'login' | 'register' }> = ({
  disabled = false,
  mode = 'login',
}) => (
  <div className="space-y-3">
    <SocialLoginButton provider="google" mode={mode} disabled={disabled} />
    {/* Facebook oculto até o app ser finalizado/aprovado no Meta. Reativar removendo o comentário. */}
    {/* <SocialLoginButton provider="facebook" mode={mode} disabled={disabled} /> */}
    <SocialLoginButton provider="twitter" mode={mode} disabled={disabled} />
    <PhoneLoginButton disabled={disabled} />
  </div>
);

export default SocialLoginButtons;
