import { useState, useEffect } from 'react';

function App() {
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);

  useEffect(() => {
    getParticipants();
  }, []);

  useEffect(() => {
    // Filter participants based on the search value
    if (search.trim()) {
      const filtered = participants.filter(
        (participant) =>
          participant.competition.toLowerCase().includes(search.toLowerCase()) ||
          participant.leader.toLowerCase().includes(search.toLowerCase()) ||
          participant.team.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredParticipants(filtered);
    } else {
      setFilteredParticipants(participants); // Show all participants when no search term
    }
  }, [search, participants]);

  const getParticipants = async () => {
    try {
      const res = await fetch('http://localhost:5000/participants');
      const data = await res.json();
      setParticipants(data);
      setFilteredParticipants(data); // Set initial filtered participants
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const markAttendance = async (competition, leader, team) => {
    try {
      const response = await fetch('http://localhost:5000/mark-attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ competition, leader, team }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark attendance');
      }
      await getParticipants();
    } catch (error) {
      console.error('Error marking attendance:', error);
    }
  };

  return (
    <div className="p-8">
        <h1 className='text-center font-bold text-4xl mb-4'>PROCOM '25 Attendance Portal</h1>
        <p className='text-center mb-10'>by Ali Nazir</p>
      <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow">
        {/* Search Input */}
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
                  className={`transition-colors ${participant.present ? 'bg-green-300' : ''}`}
                >
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.competition}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.leader}</td>
                  <td className="px-6 py-4 text-sm text-gray-800">{participant.team}</td>
                  <td className="px-6 py-4">
                    <button
                      disabled={participant.present}
                      onClick={() => markAttendance(participant.competition, participant.leader, participant.team)}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${participant.present
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                      {participant.present ? 'Marked Present' : 'Mark Attendance'}
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
