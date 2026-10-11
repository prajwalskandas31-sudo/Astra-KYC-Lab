import {
  AnswerAttempt,
  Customer,
  DashboardStats,
  HealthCheck,
  Question,
  Session,
  SessionResult,
  SessionWithCustomer,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const err = await res.json();
      if (err.detail) {
        errorDetail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Health
  getHealth: () => fetchJson<HealthCheck>("/health"),

  // Dashboard
  getDashboardStats: () => fetchJson<DashboardStats>("/dashboard/stats"),

  // Demo Reset
  resetDemoData: () =>
    fetchJson<{ message: string }>("/demo/reset", { method: "POST" }),

  // Customers
  getCustomers: () => fetchJson<Customer[]>("/customers"),
  getCustomer: (id: string) => fetchJson<Customer>(`/customers/${id}`),

  // Sessions
  createSession: (customerId: string) =>
    fetchJson<Session>("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    }),
  getSessions: () => fetchJson<Session[]>("/sessions"),
  getSession: (id: string) => fetchJson<SessionWithCustomer>(`/sessions/${id}`),
  getSessionQuestions: (id: string) =>
    fetchJson<Question[]>(`/sessions/${id}/questions`),
  completeSession: (id: string) =>
    fetchJson<SessionResult>(`/sessions/${id}/complete`, { method: "POST" }),
  cancelSession: (id: string) =>
    fetchJson<Session>(`/sessions/${id}/cancel`, { method: "POST" }),
  getSessionResults: (id: string) =>
    fetchJson<SessionResult>(`/sessions/${id}/results`),

  // Answers & Audio
  submitAnswer: async (
    sessionId: string,
    questionIndex: number,
    questionField: string,
    questionType: string,
    audioBlob: Blob
  ): Promise<AnswerAttempt> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, `recording_${sessionId}_q${questionIndex}.webm`);

    const query = new URLSearchParams({
      question_index: questionIndex.toString(),
      question_field: questionField,
      question_type: questionType,
    });

    const res = await fetch(`${API_BASE}/sessions/${sessionId}/answers?${query}`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      let errorDetail = `Failed to submit answer (HTTP ${res.status})`;
      try {
        const err = await res.json();
        if (err.detail) errorDetail = err.detail;
      } catch {
        // ignore
      }
      throw new Error(errorDetail);
    }

    return res.json();
  },

  transcribeAnswer: (sessionId: string, answerId: string) =>
    fetchJson<AnswerAttempt>(
      `/sessions/${sessionId}/answers/${answerId}/transcribe`,
      { method: "POST" }
    ),
};
