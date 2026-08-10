import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';

interface Client {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
}

export default function SmartClientInput({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Client[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axiosClient.get(`/clients/?q=${query}&limit=10`);
        setResults(res.data.data || []);
      } catch (err) {
        console.error('Error fetching clients', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (client: Client) => {
    onChange(client.name);
    setQuery(client.name);
    setIsOpen(false);
  };

  return (
    <div className="mb-4 text-right relative" dir="rtl">
      <label className="block text-gray-700 font-bold mb-2">לקוח (הזן שם לחיפוש או יצירה אוטומטית)</label>
      <input 
        type="text" 
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        placeholder="חפש לקוח קיים או הקלד שם חדש..."
      />
      
      {isOpen && results.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-60 overflow-auto">
          {results.map((c) => (
            <li 
              key={c.id} 
              onClick={() => handleSelect(c)}
              className="p-3 border-b hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div className="font-bold text-gray-900">{c.name}</div>
              <div className="text-sm text-gray-500 flex gap-2">
                {c.contact_person && <span>איש קשר: {c.contact_person}</span>}
                {c.phone && <span>טלפון: {c.phone}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
