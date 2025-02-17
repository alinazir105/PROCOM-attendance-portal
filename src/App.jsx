import { useState, useEffect } from 'react';

function App() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getParticipants();
  }, []);

  useEffect(() => {
    if (search.trim()) {
      const filtered = participants.filter(
        (participant) =>
          participant.competition.toLowerCase().includes(search.toLowerCase()) ||
          participant.leader.toLowerCase().includes(search.toLowerCase()) ||
          participant.team.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredParticipants(filtered);
    } else {
      setFilteredParticipants(participants);
    }
  }, [search, participants]);

  const getParticipants = async () => {
    try {
      const res = await fetch('https://procom-attendance-portal.onrender.com/participants');
      if (!res.ok) {
        throw new Error('Failed to fetch participants');
      }
      const data = await res.json();
      console.log('Fetched participants:', data); // Debug log
      setParticipants(data);
      setFilteredParticipants(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching participants:', error);
      setError('Failed to fetch participants. Please try again.');
    }
  };

  const markAttendance = async (competition, leader, team) => {
    try {
      setError(null);
      const response = await fetch('https://procom-attendance-portal.onrender.com/mark-attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ competition, leader, team }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark attendance');
      }

      // Update local state immediately for better UX
      setParticipants(prevParticipants =>
        prevParticipants.map(p =>
          p.team === team && p.competition === competition && p.leader === leader
            ? { ...p, present: true }
            : p
        )
      );

      // Still fetch fresh data from server to ensure consistency
      await getParticipants();
    } catch (error) {
      console.error('Error marking attendance:', error);
      setError('Failed to mark attendance. Please try again.');
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-center font-bold text-4xl mb-4">PROCOM '25 Attendance Portal</h1>
      <p className="text-center mb-10">by Ali Nazir</p>
      {error && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}
      <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow">
        <input
          type="text"
          placeholder="Search by Competition, Leader, or Team"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full p-2 border border-gray-300 rounded"
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-b">Competition</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-b">Leader Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-b">Team Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 border-b">Mark Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredParticipants.map((participant, index) => (
                <tr
                  key={index}
                  className={`transition-colors hover:bg-gray-50 ${
                    participant.present ? 'bg-green-100 hover:bg-green-200' : ''
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.competition}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.leader}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.team}</td>
                  <td className="px-6 py-4">
                    <button
                      disabled={participant.present}
                      onClick={() => markAttendance(participant.competition, participant.leader, participant.team)}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                        participant.present
                          ? 'bg-green-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {participant.present ? 'Present ✓' : 'Mark Attendance'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;