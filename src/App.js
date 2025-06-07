import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Building, User, BarChart, Send, Search, Trash2 } from 'lucide-react';

// --- Components ---

const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
);

const Modal = ({ isOpen, onClose, onConfirm, title, children, confirmText = "Confirm", confirmColor = "bg-red-600", showCancel = true }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2">{title}</h3>
                    <div className="text-sm text-gray-600">
                        {children}
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse gap-3 rounded-b-lg">
                    {onConfirm && (
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-semibold text-white ${confirmColor} hover:opacity-90 rounded-md transition-colors shadow-sm`}
                        >
                            {confirmText}
                        </button>
                    )}
                    {showCancel && (
                         <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 rounded-md transition-colors border border-gray-300 shadow-sm"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Form State
    const [companyUuid, setCompanyUuid] = useState('');
    const [salesManager, setSalesManager] = useState('');
    const [expectedOriginations, setExpectedOriginations] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');

    // Data Display State
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalState, setModalState] = useState({ isOpen: false });


    // --- Firebase Initialization ---
    useEffect(() => {
        const firebaseConfig = {
            apiKey: "AIzaSyCyUHAMzYjYRxHYDG5XV7ZJECjemD6v4w0",
            authDomain: "sql-snippet-base.firebaseapp.com",
            projectId: "sql-snippet-base",
            storageBucket: "sql-snippet-base.firebasestorage.app",
            messagingSenderId: "764332524304",
            appId: "1:764332524304:web:1a4b014f3f7f1d0ae35b95",
            measurementId: "G-XBJ6YBJ8H4"
        };

        if (!firebaseConfig.apiKey) {
            console.error("Firebase config not found!");
            setIsLoading(false);
            return;
        }
        
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                     try {
                        await signInAnonymously(firebaseAuth);
                    } catch (error) {
                        console.error("Anonymous Auth Error:", error);
                    }
                }
                 setIsAuthReady(true);
            });
            
            return () => unsubscribe();
        } catch(error) {
            console.error("Firebase initialization error:", error);
            setIsLoading(false);
        }
    }, []);

    // --- Data Fetching from Firestore ---
    useEffect(() => {
        if (!isAuthReady || !db) {
            return;
        }

        setIsLoading(true);
        const submissionsColRef = collection(db, 'tableau-submissions');
        
        const unsubscribe = onSnapshot(submissionsColRef, (snapshot) => {
            try {
                const fetchedSubmissions = snapshot.docs.map(doc => {
                    const data = doc.data();
                    // Robust date checking
                    const submittedAtDate = (data.submittedAt && typeof data.submittedAt.toDate === 'function')
                        ? data.submittedAt.toDate()
                        : null;
                    
                    return { 
                        id: doc.id, 
                        ...data,
                        submittedAtDate: submittedAtDate,
                        submittedAt: submittedAtDate ? submittedAtDate.toLocaleString() : 'N/A'
                    };
                });
                
                fetchedSubmissions.sort((a, b) => {
                    const dateA = a.submittedAtDate || new Date(0); // Fallback to epoch if null
                    const dateB = b.submittedAtDate || new Date(0); // Fallback to epoch if null
                    return dateB - dateA; // Sort descending (newest first)
                });

                setSubmissions(fetchedSubmissions);
            } catch (error) {
                console.error("Error processing data:", error);
                // Optionally set an error state to show in the UI
            } finally {
                setIsLoading(false);
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            setIsLoading(false);
        });
        
        return () => unsubscribe();
    }, [isAuthReady, db]);

    // --- Form Submission Logic ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!companyUuid || !salesManager || !expectedOriginations) {
            setSubmitMessage('Please fill out all fields.');
            setTimeout(() => setSubmitMessage(''), 3000);
            return;
        }

        if (!db) {
            setSubmitMessage('Database not connected. Please try again later.');
            setTimeout(() => setSubmitMessage(''), 3000);
            return;
        }

        setIsSubmitting(true);
        setSubmitMessage('');

        try {
            const submissionsColRef = collection(db, 'tableau-submissions');
            await addDoc(submissionsColRef, {
                company_uuid: companyUuid,
                sales_manager: salesManager,
                expected_originations: Number(expectedOriginations),
                submittedAt: serverTimestamp(),
                submittedBy: userId 
            });
            
            setCompanyUuid('');
            setSalesManager('');
            setExpectedOriginations('');
            setSubmitMessage('Data submitted successfully!');

        } catch (error) {
            console.error("Error submitting data:", error);
            setSubmitMessage('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setSubmitMessage(''), 3000);
        }
    };

    // --- Deletion Logic ---
    const handleDelete = async (id) => {
        if (!db) {
            console.error("Database not connected.");
            return;
        }
        try {
            const submissionDocRef = doc(db, 'tableau-submissions', id);
            await deleteDoc(submissionDocRef);
        } catch (error) {
            console.error("Error deleting document:", error);
            setModalState({
                isOpen: true,
                title: "Error",
                body: <p>There was an error deleting the entry. Please try again.</p>,
                onConfirm: () => setModalState({ isOpen: false }),
                confirmText: "OK",
                confirmColor: 'bg-gray-600',
                showCancel: false,
            });
        }
    };

    const confirmDelete = (id, uuid) => {
        setModalState({
            isOpen: true,
            title: "Confirm Deletion",
            body: <p>Are you sure you want to delete the entry for company <strong className="font-mono bg-gray-100 p-1 rounded">{uuid}</strong>? This action cannot be undone.</p>,
            onConfirm: () => {
                handleDelete(id);
                setModalState({ isOpen: false });
            },
            confirmText: "Delete",
            confirmColor: 'bg-red-600 hover:bg-red-700',
            showCancel: true,
        });
    };

    // --- Filtering Logic for Display ---
    const filteredSubmissions = useMemo(() => {
        return submissions.filter(s => 
            s.company_uuid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.sales_manager?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [submissions, searchTerm]);


    // --- Render JSX ---
    return (
        <>
            <Modal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false })}
                onConfirm={modalState.onConfirm}
                title={modalState.title}
                confirmText={modalState.confirmText}
                confirmColor={modalState.confirmColor}
                showCancel={modalState.showCancel}
            >
                {modalState.body}
            </Modal>
            <div className="h-screen w-screen bg-gray-100 font-sans flex items-center justify-center p-6 md:p-8">
                <main className="w-full h-full bg-white rounded-2xl shadow-2xl flex flex-col lg:flex-row overflow-hidden">
                    
                    <div className="w-full lg:w-1/3 xl:w-1/4 p-8 border-r border-gray-200 flex flex-col">
                        <header className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900">Tableau Data Input</h1>
                            <p className="text-gray-500 mt-2">Enter the required information below.</p>
                        </header>
                        <form onSubmit={handleSubmit} className="flex-grow flex flex-col gap-6">
                            <div>
                                <label htmlFor="company-uuid" className="block text-sm font-medium text-gray-700 mb-1">Company UUID</label>
                                <div className="relative">
                                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input id="company-uuid" type="text" value={companyUuid} onChange={(e) => setCompanyUuid(e.target.value)} placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="sales-manager" className="block text-sm font-medium text-gray-700 mb-1">Sales Manager</label>
                                 <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input id="sales-manager" type="text" value={salesManager} onChange={(e) => setSalesManager(e.target.value)} placeholder="e.g., John Doe" className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="expected-originations" className="block text-sm font-medium text-gray-700 mb-1">Expected Originations / Month</label>
                                 <div className="relative">
                                    <BarChart className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input id="expected-originations" type="number" value={expectedOriginations} onChange={(e) => setExpectedOriginations(e.target.value)} placeholder="e.g., 50000" className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div className="mt-auto pt-6">
                               <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold shadow-sm disabled:bg-blue-400">
                                    {isSubmitting ? <Spinner /> : <Send size={18} />}
                                    {isSubmitting ? 'Submitting...' : 'Submit Data'}
                                </button>
                                {submitMessage && (
                                    <p className={`mt-4 text-sm text-center ${submitMessage.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                                        {submitMessage}
                                    </p>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="w-full lg:w-2/3 xl:w-3/4 p-8 flex flex-col bg-gray-50/50">
                        <div className="relative mb-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input type="text" placeholder="Search by Company or Sales Manager..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div className="flex-grow overflow-y-auto">
                             <table className="w-full text-left table-auto">
                                <thead className="sticky top-0 bg-gray-100 z-10">
                                    <tr>
                                        <th className="p-3 text-sm font-semibold text-gray-600 w-2/5">Company UUID</th>
                                        <th className="p-3 text-sm font-semibold text-gray-600 w-1/5">Sales Manager</th>
                                        <th className="p-3 text-sm font-semibold text-gray-600 w-1/5">Expected Originations</th>
                                        <th className="p-3 text-sm font-semibold text-gray-600 w-1/5">Submitted At</th>
                                        <th className="p-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr><td colSpan="5" className="text-center p-8 text-gray-500">Loading data...</td></tr>
                                    ) : filteredSubmissions.length > 0 ? (
                                        filteredSubmissions.map(sub => (
                                            <tr key={sub.id} className="hover:bg-gray-100">
                                                <td className="p-3 text-sm text-gray-700 font-mono break-all">{sub.company_uuid}</td>
                                                <td className="p-3 text-sm text-gray-700">{sub.sales_manager}</td>
                                                <td className="p-3 text-sm text-gray-700">{Number(sub.expected_originations).toLocaleString()}</td>
                                                <td className="p-3 text-sm text-gray-500">{sub.submittedAt}</td>
                                                <td className="p-3 text-sm text-gray-700 text-right">
                                                    <button 
                                                        onClick={() => confirmDelete(sub.id, sub.company_uuid)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                        title="Delete entry"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="5" className="text-center p-8 text-gray-500">No submissions yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
