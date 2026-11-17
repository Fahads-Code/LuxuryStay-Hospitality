import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, UserPlus, AlertTriangle, BedDouble } from 'lucide-react';
import api, { errorMessage } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  addDaysISO,
  currency,
  formatDate,
  todayISO,
} from '../lib/format.js';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from './ui.jsx';
import GuestFormModal from './GuestFormModal.jsx';

const BookingFormModal = ({ open, onClose, onCreated }) => {
  const toast = useToast();
  const [guests, setGuests] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({
    guest: '',
    checkIn: todayISO(),
    checkOut: addDaysISO(todayISO(), 1),
    adults: 2,
    children: 0,
    roomType: '',
    source: 'staff',
    specialRequests: '',
    ratePerNight: '',
  });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guestModal, setGuestModal] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedRoom('');
    Promise.all([
      api.get('/guests?limit=200'),
      api.get('/room-types'),
      api.get('/settings'),
    ])
      .then(([guestsRes, typesRes, settingsRes]) => {
        setGuests(guestsRes.data.guests);
        setRoomTypes(typesRes.data.roomTypes);
        setSettings(settingsRes.data.settings);
      })
      .catch((error) => toast.error(errorMessage(error)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nights = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return 0;
    return Math.max(
      0,
      Math.round(
        (new Date(`${form.checkOut}T00:00:00`) - new Date(`${form.checkIn}T00:00:00`)) / 86400000
      )
    );
  }, [form.checkIn, form.checkOut]);

  useEffect(() => {
    if (!open || !form.checkIn || !form.checkOut || nights <= 0) return;
    let active = true;
    setLoadingRooms(true);
    setSelectedRoom('');
    api
      .get('/bookings/availability', {
        params: {
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: Number(form.adults) + Number(form.children),
          roomType: form.roomType || undefined,
        },
      })
      .then(({ data }) => {
        if (active) setAvailableRooms(data.availableRooms);
      })
      .catch((error) => {
        if (active) toast.error(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingRooms(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.checkIn, form.checkOut, form.roomType, form.adults, form.children]);

  const room = availableRooms.find((item) => item._id === selectedRoom);
  const rate = Number(form.ratePerNight || room?.rate || 0);
  const subtotal = rate * nights;
  const tax = subtotal * ((settings?.taxRate || 0) / 100);
  const total = subtotal + tax;

  const submit = async (event) => {
    event.preventDefault();
    if (!form.guest) return toast.error('Select a guest for this reservation.');
    if (!selectedRoom) return toast.error('Choose an available room.');
    setSaving(true);
    try {
      const payload = {
        guest: form.guest,
        room: selectedRoom,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        source: form.source,
        specialRequests: form.specialRequests,
        ...(form.ratePerNight !== '' ? { ratePerNight: Number(form.ratePerNight) } : {}),
      };
      const { data } = await api.post('/bookings', payload);
      toast.success(`Reservation ${data.booking.reference} created.`);
      onCreated?.(data.booking);
      onClose();
      setForm({
        ...form,
        guest: '',
        specialRequests: '',
        ratePerNight: '',
      });
      setSelectedRoom('');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const addGuest = (guest) => {
    setGuests((items) => [guest, ...items]);
    setForm((current) => ({ ...current, guest: guest._id }));
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Create a reservation"
        subtitle="Check live availability and confirm a stay in a few thoughtful steps."
        size="xl"
        footer={
          <>
            <div className="modal-foot-summary">
              {nights > 0 && (
                <>
                  <span>{nights} night{nights > 1 ? 's' : ''}</span>
                  <strong>{currency(total)}</strong>
                  <em>incl. tax</em>
                </>
              )}
            </div>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={saving} icon={CalendarPlus} disabled={!selectedRoom || !form.guest}>
              Confirm reservation
            </Button>
          </>
        }
      >
        <form className="booking-create" onSubmit={submit}>
          <div className="booking-create-section">
            <div className="booking-create-head">
              <span className="step-dot">1</span>
              <div>
                <h3>Guest & dates</h3>
                <p>Who is arriving, and when?</p>
              </div>
            </div>
            <div className="form-row al-end">
              <Field label="Guest" required>
                <div className="form-inline">
                  <Select
                    value={form.guest}
                    onChange={(event) => setForm({ ...form, guest: event.target.value })}
                    required
                  >
                    <option value="">Select a guest</option>
                    {guests.map((guest) => (
                      <option key={guest._id} value={guest._id}>
                        {guest.firstName} {guest.lastName} {guest.email ? `· ${guest.email}` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" size="sm" icon={UserPlus} onClick={() => setGuestModal(true)}>
                    New
                  </Button>
                </div>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Check-in" required>
                <Input
                  type="date"
                  value={form.checkIn}
                  min={todayISO()}
                  onChange={(event) => {
                    const checkIn = event.target.value;
                    setForm({
                      ...form,
                      checkIn,
                      checkOut:
                        form.checkOut <= checkIn ? addDaysISO(checkIn, 1) : form.checkOut,
                    });
                  }}
                  required
                />
              </Field>
              <Field label="Check-out" required>
                <Input
                  type="date"
                  value={form.checkOut}
                  min={addDaysISO(form.checkIn, 1)}
                  onChange={(event) => setForm({ ...form, checkOut: event.target.value })}
                  required
                />
              </Field>
            </div>
            <div className="form-row three">
              <Field label="Adults">
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={form.adults}
                  onChange={(event) => setForm({ ...form, adults: event.target.value })}
                />
              </Field>
              <Field label="Children">
                <Input
                  type="number"
                  min="0"
                  max="8"
                  value={form.children}
                  onChange={(event) => setForm({ ...form, children: event.target.value })}
                />
              </Field>
              <Field label="Booking source">
                <Select
                  value={form.source}
                  onChange={(event) => setForm({ ...form, source: event.target.value })}
                >
                  <option value="staff">Front desk</option>
                  <option value="walk_in">Walk-in</option>
                  <option value="phone">Phone</option>
                  <option value="online">Online</option>
                  <option value="corporate">Corporate</option>
                </Select>
              </Field>
            </div>
          </div>

          <div className="booking-create-section">
            <div className="booking-create-head">
              <span className="step-dot">2</span>
              <div>
                <h3>Room selection</h3>
                <p>Only rooms available for the full stay are shown.</p>
              </div>
            </div>
            <Field label="Room type">
              <Select
                value={form.roomType}
                onChange={(event) => setForm({ ...form, roomType: event.target.value })}
              >
                <option value="">Any room type</option>
                {roomTypes.map((type) => (
                  <option key={type._id} value={type._id}>
                    {type.name} · up to {type.capacity} guests
                  </option>
                ))}
              </Select>
            </Field>

            {loadingRooms ? (
              <Spinner label="Checking availability…" />
            ) : availableRooms.length === 0 ? (
              <div className="inline-alert">
                <AlertTriangle size={17} />
                <span>No rooms are available for these dates and party size. Try different dates.</span>
              </div>
            ) : (
              <div className="available-rooms">
                {availableRooms.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`available-room ${selectedRoom === item._id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedRoom(item._id);
                      setForm({ ...form, ratePerNight: '' });
                    }}
                  >
                    <span className="available-room-icon"><BedDouble size={16} /></span>
                    <span>
                      <strong>Room {item.number}</strong>
                      <em>{item.type?.name} · {item.view}</em>
                    </span>
                    <span className="available-room-rate">{currency(item.rate)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="booking-create-section">
            <div className="booking-create-head">
              <span className="step-dot">3</span>
              <div>
                <h3>Rate & notes</h3>
                <p>Fine-tune the stay before confirming.</p>
              </div>
            </div>
            <div className="form-row">
              <Field label="Nightly rate override" hint="Leave blank to use the room's rate.">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ratePerNight}
                  onChange={(event) => setForm({ ...form, ratePerNight: event.target.value })}
                  placeholder={room ? String(room.rate) : 'Room rate'}
                />
              </Field>
              <Field label="Special requests">
                <Input
                  value={form.specialRequests}
                  onChange={(event) => setForm({ ...form, specialRequests: event.target.value })}
                  placeholder="High floor, late arrival…"
                />
              </Field>
            </div>
            <div className="booking-create-summary">
              <div><span>Room subtotal</span><strong>{currency(subtotal)}</strong></div>
              <div><span>Tax ({settings?.taxRate || 0}%)</span><strong>{currency(tax)}</strong></div>
              <div className="total"><span>Total</span><strong>{currency(total)}</strong></div>
            </div>
          </div>
        </form>
      </Modal>

      <GuestFormModal
        open={guestModal}
        onClose={() => setGuestModal(false)}
        onSaved={addGuest}
      />
    </>
  );
};

export default BookingFormModal;
