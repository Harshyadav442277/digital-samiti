import { ArrowLeft, Sprout } from 'lucide-react';
import { WalletSignIn } from './wallet-sign-in';

export function AccountForm() {
  return <main className="account-page">
    <a href="/" className="back-link"><ArrowLeft size={17}/> Back to the start</a>
    <div className="account-card">
      <span className="modal-symbol"><Sprout size={28}/></span>
      <h1>Your wallet is your account.</h1>
      <p>Approve the connection and sign the message in Nimiq Pay. First-time sign-in opens a new workspace for your wallet.</p>
      <WalletSignIn/>
    </div>
  </main>;
}
