const admin = require('firebase-admin');

// Remplacez par le chemin absolu vers votre fichier de clé de service
const serviceAccount = require('./pharmaconnect-31315-firebase-adminsdk-fbsvc-dc8826a0c0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Données des pharmacies
const pharmacies = [
  { name: 'Pharmacie Centrale', address: 'Avenue 13, Djibouti', distance: 1.2, isOnline: true, phone: '+25377880011', licenseNumber: 'LIC-001', responseTime: 5, stockLevel: 80, rating: 4.5 },
  { name: 'Pharmacie de la Paix', address: 'Balbala, Djibouti', distance: 2.5, isOnline: true, phone: '+25377880022', licenseNumber: 'LIC-002', responseTime: 7, stockLevel: 90, rating: 4.2 },
  { name: 'Pharmacie du Port', address: 'Boulevard, Djibouti', distance: 3.0, isOnline: true, phone: '+25377880033', licenseNumber: 'LIC-003', responseTime: 6, stockLevel: 70, rating: 4.0 }
];

// Données des médicaments
const medicines = [
  { baseName: 'DOLIPRANE', dci: 'Paracétamol', packaging: 'Boîte de 8 comprimés', defaultPrice: 2500, isColdChain: false, isPsychotropic: false },
  { baseName: 'DOLIPRANE', dci: 'Paracétamol', packaging: 'Boîte de 16 comprimés', defaultPrice: 4500, isColdChain: false, isPsychotropic: false },
  { baseName: 'EFFERALGAN', dci: 'Paracétamol', packaging: 'Boîte de 16 comprimés effervescents', defaultPrice: 4800, isColdChain: false, isPsychotropic: false },
  { baseName: 'ADVIL', dci: 'Ibuprofène', packaging: 'Boîte de 12 gélules 200mg', defaultPrice: 3800, isColdChain: false, isPsychotropic: false },
  { baseName: 'AMOXICILLINE', dci: 'Amoxicilline', packaging: 'Boîte de 16 gélules 500mg', defaultPrice: 8900, isColdChain: false, isPsychotropic: false },
  { baseName: 'ASPEGIC', dci: 'Acide acétylsalicylique', packaging: 'Boîte de 20 sachets 500mg', defaultPrice: 5400, isColdChain: false, isPsychotropic: false },
  { baseName: 'MOPRAL', dci: 'Oméprazole', packaging: 'Boîte de 14 gélules 20mg', defaultPrice: 7200, isColdChain: false, isPsychotropic: false },
  { baseName: 'ZYRTEC', dci: 'Cétirizine', packaging: 'Boîte de 15 comprimés 10mg', defaultPrice: 6300, isColdChain: false, isPsychotropic: false },
  { baseName: 'AMLOR', dci: 'Amlodipine', packaging: 'Boîte de 30 comprimés 5mg', defaultPrice: 8400, isColdChain: false, isPsychotropic: false },
  { baseName: 'GLUCOPHAGE', dci: 'Metformine', packaging: 'Boîte de 60 comprimés 1000mg', defaultPrice: 8900, isColdChain: false, isPsychotropic: false }
];

async function seed() {
  console.log('Ajout des pharmacies...');
  for (const pharm of pharmacies) {
    await db.collection('pharmacies').add(pharm);
  }
  console.log('Ajout des médicaments...');
  for (const med of medicines) {
    await db.collection('medicines').add(med);
  }
  console.log('Terminé !');
}

seed().catch(console.error);