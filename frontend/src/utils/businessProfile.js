export function formatBusinessDisplayName(profile, fallback = '') {
  const businessName = profile?.businessName || profile?.name || fallback;
  const owner1Name = profile?.ownerName1 || profile?.ownerName;
  const owner1Number = profile?.ownerNumber1 || profile?.mobileNumber;
  const owner2Name = profile?.ownerName2;
  const owner2Number = profile?.ownerNumber2;
  const owners = [
    [owner1Name, owner1Number ? `(${owner1Number})` : ''].filter(Boolean).join(' '),
    [owner2Name, owner2Number ? `(${owner2Number})` : ''].filter(Boolean).join(' ')
  ].filter(Boolean);

  return [...owners, businessName].filter(Boolean).join(' | ');
}
