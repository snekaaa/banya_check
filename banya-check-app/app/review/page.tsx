'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Question = {
  id: string;
  label: string;
  rating: number;
};

export default function Review() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([
    { id: 'food', label: 'Еда', rating: 0 },
    { id: 'sauna', label: 'Парная', rating: 0 },
    { id: 'comfort', label: 'Комфорт и удобство', rating: 0 },
    { id: 'value', label: 'Цена/качество', rating: 0 },
    { id: 'overall', label: 'Общее впечатление', rating: 0 },
  ]);

  const updateRating = (id: string, rating: number) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, rating } : q));
  };

  const handleSubmit = () => {
    const allRated = questions.every(q => q.rating > 0);
    if (!allRated) {
      return;
    }
    // TODO: Отправить отзыв на сервер
    console.log('Review submitted:', questions);
    router.push('/?paid=true');
  };

  const handleSkip = () => {
    router.push('/?paid=true');
  };

  const allRated = questions.every(q => q.rating > 0);

  return (
    <div className="min-h-screen bg-[var(--tg-theme-bg-color,#ffffff)] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] py-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[var(--tg-theme-button-color,#3390ec)] rounded-3xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-5xl">🧖</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--tg-theme-text-color,#000000)] mb-3">
            Понравилась баня?
          </h1>
          <p className="text-base text-[var(--tg-theme-hint-color,#999999)]">
            Оцените посещение бани &quot;Изба&quot;
          </p>
        </div>

        {/* Questions */}
        <div className="space-y-8 mb-8">
          {questions.map(question => (
            <div key={question.id}>
              <div className="text-base font-medium text-[var(--tg-theme-text-color,#000000)] mb-3 text-center">
                {question.label}
              </div>
              <div className="flex justify-center items-center gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => updateRating(question.id, star)}
                    className="w-14 h-14 flex items-center justify-center transition-all active:scale-90"
                  >
                    <span className="text-4xl">
                      {question.rating >= star ? '⭐' : '☆'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleSubmit}
            disabled={!allRated}
            className={`w-full font-semibold py-4 rounded-xl transition-all ${
              allRated
                ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-white active:scale-95'
                : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-hint-color,#999999)] cursor-not-allowed'
            }`}
          >
            Отправить
          </button>
          <button
            onClick={handleSkip}
            className="w-full font-medium py-4 text-[var(--tg-theme-hint-color,#999999)] transition-all active:opacity-50"
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
}
