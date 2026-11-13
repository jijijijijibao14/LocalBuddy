import { useEffect, useState } from "react";
import { Pencil, Star, X } from "lucide-react";
import api from "../services/api";

function FeedbackStars({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          disabled={!onChange}
          aria-label={`${star} sao`}
          className="rounded p-0.5 disabled:cursor-default"
        >
          <Star size={19} className={star <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
        </button>
      ))}
    </div>
  );
}

export default function TripFeedback({ booking, viewerRole, onUpdated }) {
  const isAdmin = viewerRole === "admin";
  const items = booking.feedback || [];
  const ownFeedback = items.find((item) => item.authorRole === viewerRole);
  const [rating, setRating] = useState(ownFeedback?.rating || 0);
  const [comment, setComment] = useState(ownFeedback?.comment || "");
  const [replyDrafts, setReplyDrafts] = useState({});
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [editingReplies, setEditingReplies] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRating(ownFeedback?.rating || 0);
    setComment(ownFeedback?.comment || "");
  }, [booking._id, ownFeedback?.rating, ownFeedback?.comment]);

  useEffect(() => {
    setEditingFeedback(false);
    setEditingReplies({});
  }, [booking._id]);

  async function saveFeedback(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put(`/bookings/${booking._id}/feedback`, { rating, comment });
      onUpdated?.({ ...booking, feedback: data.feedback });
      setEditingFeedback(false);
      window.dispatchEvent(new Event("lb-notifications-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể lưu feedback.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReply(event, feedback) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.put(
        `/bookings/${booking._id}/feedback/${feedback._id}/reply`,
        { reply: replyDrafts[feedback._id] ?? feedback.reply ?? "" },
      );
      onUpdated?.({ ...booking, feedback: data.feedback });
      setEditingReplies((current) => ({ ...current, [feedback._id]: false }));
      window.dispatchEvent(new Event("lb-notifications-change"));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể lưu phản hồi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="w-full rounded-2xl bg-slate-50 p-4" aria-label="Feedback chuyến đi">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-navy">Feedback chuyến đi</h3>
        {!isAdmin && !ownFeedback && (
          <button
            type="button"
            className="rounded-lg p-2 text-brand hover:bg-blue-50"
            title="Gửi feedback"
            aria-label="Gửi feedback"
            onClick={() => setEditingFeedback((current) => !current)}
          >
            {editingFeedback ? <X size={17} /> : <Pencil size={17} />}
          </button>
        )}
      </div>
      {!items.length && isAdmin && <p className="mt-2 text-sm text-slate-500">Chưa có feedback.</p>}
      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const isMine = item.authorRole === viewerRole;
          const canReply = !isAdmin && !isMine;
          const editingReply = Boolean(editingReplies[item._id]);
          return (
            <article key={item._id || item.authorRole} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-sm text-navy">
                  {item.author?.fullName || (item.authorRole === "local" ? "Local" : "Traveler")}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    ({item.authorRole === "local" ? "Local đánh giá" : "Traveler đánh giá"})
                  </span>
                </b>
                <div className="flex items-center gap-2">
                  <FeedbackStars value={item.rating} label={`Đánh giá ${item.rating} sao`} />
                  {!isAdmin && (isMine || canReply) && (
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-brand hover:bg-blue-50"
                      title={isMine ? "Chỉnh sửa feedback" : item.reply ? "Chỉnh sửa phản hồi" : "Trả lời feedback"}
                      aria-label={isMine ? "Chỉnh sửa feedback" : item.reply ? "Chỉnh sửa phản hồi" : "Trả lời feedback"}
                      onClick={() => isMine
                        ? setEditingFeedback((current) => !current)
                        : setEditingReplies((current) => ({ ...current, [item._id]: !current[item._id] }))}
                    >
                      {(isMine && editingFeedback) || (canReply && editingReply) ? <X size={15} /> : <Pencil size={15} />}
                    </button>
                  )}
                </div>
              </div>
              {isMine && editingFeedback ? (
                <FeedbackForm
                  rating={rating}
                  comment={comment}
                  saving={saving}
                  onRatingChange={setRating}
                  onCommentChange={setComment}
                  onSubmit={saveFeedback}
                  onCancel={() => setEditingFeedback(false)}
                  submitLabel="Cập nhật feedback"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.comment}</p>
              )}
              {item.reply && (
                <div className="mt-3 rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-bold text-brand">Phản hồi</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.reply}</p>
                </div>
              )}
              {canReply && editingReply && (
                <form className="mt-3 space-y-2" onSubmit={(event) => saveReply(event, item)}>
                  <label className="block text-xs font-bold text-slate-600">
                    {item.reply ? "Chỉnh sửa phản hồi" : "Trả lời feedback"}
                    <textarea
                      className="field mt-1"
                      maxLength={1000}
                      rows={2}
                      required
                      value={replyDrafts[item._id] ?? item.reply ?? ""}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [item._id]: event.target.value }))}
                    />
                  </label>
                  <button className="btn-light !py-2" type="submit" disabled={saving}>
                    {saving ? "Đang lưu..." : item.reply ? "Cập nhật phản hồi" : "Gửi phản hồi"}
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
      {!isAdmin && editingFeedback && !ownFeedback && (
        <FeedbackForm
          rating={rating}
          comment={comment}
          saving={saving}
          onRatingChange={setRating}
          onCommentChange={setComment}
          onSubmit={saveFeedback}
          onCancel={() => setEditingFeedback(false)}
          submitLabel="Gửi feedback"
        />
      )}
      {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
    </section>
  );
}

function FeedbackForm({ rating, comment, saving, onRatingChange, onCommentChange, onSubmit, onCancel, submitLabel }) {
  return (
    <form className="mt-3 border-t border-slate-100 pt-3" onSubmit={onSubmit}>
      <FeedbackStars value={rating} onChange={onRatingChange} label="Chọn số sao từ 1 đến 5" />
      <label className="mt-2 block text-xs font-bold text-slate-600">
        Nhận xét
        <textarea
          className="field mt-1"
          maxLength={1000}
          rows={3}
          required
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary !py-2" type="submit" disabled={saving || !rating || !comment.trim()}>
          {saving ? "Đang lưu..." : submitLabel}
        </button>
        <button className="btn-light !py-2" type="button" onClick={onCancel} disabled={saving}>Hủy</button>
      </div>
    </form>
  );
}
