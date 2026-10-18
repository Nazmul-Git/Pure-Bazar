'use client';

import { useState } from 'react';
import { BadgeCheck, Search, UserRoundCheck } from 'lucide-react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Select from '@/components/ui/select';
import Modal from '@/components/ui/modal';
import { posErrorMessage, verifyPosMember } from '@/services/pos';

export default function ShareholderModal({ open, onClose, onVerified }) {
  const [searchType, setSearchType] = useState('mobile');
  const [identifier, setIdentifier] = useState('');
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setIdentifier('');
    setMember(null);
    setError('');
    onClose();
  }

  async function submit(event) {
    event.preventDefault();
    const value = identifier.trim();
    if (!value || loading) return;
    setLoading(true);
    setError('');
    setMember(null);
    try {
      const { data } = await verifyPosMember({ [searchType]: value });
      setMember(data.shareholder);
    } catch (requestError) {
      setError(posErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Verify shareholder">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">Verify the member with Probashi before attaching them to this bill.</p>
        <Select label="Find member by" value={searchType} onChange={(event) => setSearchType(event.target.value)}>
          <option value="mobile">Mobile number</option>
          <option value="memberId">Member ID</option>
        </Select>
        <Input
          label={searchType === 'mobile' ? 'Mobile number' : 'Member ID'}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="off"
          required
        />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {member && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <BadgeCheck size={18} /> Verified active shareholder
            </p>
            <p className="mt-1 text-sm text-emerald-800">{member.name} · {member.memberId}</p>
            {member.mobile && <p className="text-sm text-emerald-800">{member.mobile}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
          {member ? (
            <Button type="button" onClick={() => { onVerified(member); close(); }}>
              <UserRoundCheck size={16} /> Attach shareholder
            </Button>
          ) : (
            <Button type="submit" disabled={loading || !identifier.trim()}>
              <Search size={16} /> {loading ? 'Verifying...' : 'Verify member'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
