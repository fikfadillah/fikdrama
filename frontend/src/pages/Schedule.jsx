import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import { api } from '../services/api';
import './Schedule.css';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function Schedule() {
    const { data, loading, error } = useFetch(() => api.schedule(), []);

    return (
        <div className="schedule-page">
            <div className="container">
                <div className="schedule-header">
                    <h1 className="schedule-title">Jadwal Tayang</h1>
                    <p className="schedule-sub">Drama yang sedang tayang berdasarkan hari</p>
                </div>

                {loading && (
                    <div className="schedule-grid">
                        {DAYS.map((d) => (
                            <div key={d} className="schedule-day-card">
                                <div className="sdc__head">{d}</div>
                                <div className="sdc__body">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px', marginBottom: '6px' }} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="empty-state" style={{ paddingTop: '60px' }}>
                        <div className="icon">⚠️</div>
                        <h3>Jadwal tidak tersedia</h3>
                        <p>Halaman jadwal mungkin belum ada di source site</p>
                    </div>
                )}

                {!loading && !error && (
                    <div className="schedule-grid">
                        {DAYS.map((day) => {
                            const shows = (data || {})[day] || [];
                            return (
                                <div key={day} className="schedule-day-card">
                                    <div className="sdc__head">{day}</div>
                                    <div className="sdc__body">
                                        {shows.length === 0 && (
                                            <p className="sdc__empty">Tidak ada jadwal</p>
                                        )}
                                        {shows.map((show, i) => (
                                            <Link key={i} to={`/series/${show.slug}`} className="sdc__item">
                                                <span className="sdc__num">{i + 1}</span>
                                                <span className="sdc__title">{show.title}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {Object.keys(data || {}).length === 0 && (
                            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                                <div className="icon">📅</div>
                                <h3>Jadwal belum tersedia</h3>
                                <p>Data jadwal sedang diperbarui</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
