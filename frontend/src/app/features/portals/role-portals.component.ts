import { Component, OnInit, OnDestroy, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

// ============================================================================
// 1. TEACHER DASHBOARD COMPONENT
// ============================================================================
@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Faculty Command Center</h1>
          <p class="page-subtitle">Manage your assigned batches, question bank, computer-based assessments, and attendance</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a routerLink="/questions" class="btn btn-secondary btn-sm">+ Upload Questions</a>
          <a routerLink="/tests" class="btn btn-primary btn-sm">+ Create / Assign Test</a>
          <a routerLink="/attendance" class="btn btn-success btn-sm">✓ Mark Attendance</a>
          <a routerLink="/messages" class="btn btn-secondary btn-sm">💬 Message Student / Parent</a>
        </div>
      </div>

      @if (data()) {
        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Assigned Batches</div>
              <div class="kpi-value">{{ data().stats.assignedClassesCount }}</div>
              <div class="kpi-sub">{{ data().teacher?.specialization }}</div>
            </div>
            <div class="kpi-icon"><span class="material-icons-outlined">groups</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Total Students</div>
              <div class="kpi-value">{{ data().stats.totalStudentsCount }}</div>
              <div class="kpi-sub">Across assigned batches</div>
            </div>
            <div class="kpi-icon" style="background:#ecfeff;color:#0891b2"><span class="material-icons-outlined">school</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Questions Authored</div>
              <div class="kpi-value">{{ data().stats.questionsCreatedCount }}</div>
              <div class="kpi-sub">In Question Bank</div>
            </div>
            <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><span class="material-icons-outlined">quiz</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Active Tests</div>
              <div class="kpi-value">{{ data().stats.upcomingTestsCount }}</div>
              <div class="kpi-sub">{{ data().stats.pendingEvaluationsCount }} Pending Subjective</div>
            </div>
            <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">assignment</span></div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:24px">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <h3 style="margin:0">Assigned Classes & Subjects</h3>
              <a routerLink="/classes" class="btn btn-secondary btn-sm">View Timetable</a>
            </div>
            @for (ca of data().teacher?.classAssignments; track ca.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9">
                <div>
                  <div style="font-weight:700">{{ ca.classBatch.name }}</div>
                  <div style="font-size:0.8rem;color:#64748b">
                    Subject: <strong>{{ ca.subject.name }}</strong> • {{ ca.classBatch.scheduleSummary }}
                  </div>
                </div>
                <span class="badge badge-primary">{{ ca.classBatch._count?.students || 0 }} Students</span>
              </div>
            }
          </div>

          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <h3 style="margin:0">Recent Student Test Submissions</h3>
              <a routerLink="/tests" class="btn btn-secondary btn-sm">Manage Tests</a>
            </div>
            @for (sub of data().recentSubmissions; track sub.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9">
                <div>
                  <div style="font-weight:700;font-size:0.88rem">
                    {{ sub.student.user.firstName }} {{ sub.student.user.lastName }}
                  </div>
                  <div style="font-size:0.78rem;color:#64748b">{{ sub.test.title }}</div>
                </div>
                <div style="text-align:right">
                  <span class="badge badge-success">{{ sub.obtainedMarks }}/{{ sub.totalMarks }} ({{ sub.percentage }}%)</span>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class TeacherDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly data = signal<any>(null);

  ngOnInit() {
    this.api.get('teachers/my-dashboard').subscribe((res) => this.data.set(res));
  }
}

// ============================================================================
// 2. STUDENT DASHBOARD COMPONENT
// ============================================================================
@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      @if (data()) {
        <div class="page-header">
          <div>
            <h1 class="page-title">
              Welcome, {{ data().student.user.firstName }} {{ data().student.user.lastName }}!
            </h1>
            <p class="page-subtitle">
              Student ID: <strong>{{ data().student.studentCode }}</strong> •
              Batch: <strong>{{ data().student.enrollments[0]?.classBatch?.name || 'General' }}</strong> •
              Target: <strong>{{ data().student.targetExam }}</strong>
            </p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a routerLink="/student/tests" class="btn btn-primary">📝 View Assigned Tests</a>
            <button class="btn btn-secondary" (click)="downloadMyReportCard()">📄 Download PDF Report Card</button>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Attendance Rate</div>
              <div class="kpi-value">{{ data().student.summary.attendancePercentage }}%</div>
              <div class="kpi-sub">{{ data().student.summary.presentCount }}/{{ data().student.summary.totalAttendance }} Sessions Attended</div>
            </div>
            <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">event_available</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Average Test Score</div>
              <div class="kpi-value">{{ data().student.summary.averagePercentage }}%</div>
              <div class="kpi-sub">{{ data().student.summary.totalTestsTaken }} Tests Completed</div>
            </div>
            <div class="kpi-icon"><span class="material-icons-outlined">insights</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Personal Best</div>
              <div class="kpi-value">{{ data().student.summary.bestPercentage }}%</div>
              <div class="kpi-sub">Highest percentage achieved</div>
            </div>
            <div class="kpi-icon" style="background:#fffbeb;color:#d97706"><span class="material-icons-outlined">emoji_events</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Assigned Tests</div>
              <div class="kpi-value">{{ data().assignedTests?.length || 0 }}</div>
              <div class="kpi-sub">Active & completed assessments</div>
            </div>
            <div class="kpi-icon" style="background:#f3e8ff;color:#7c3aed"><span class="material-icons-outlined">assignment</span></div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:24px">
          <!-- Assigned Tests -->
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <h3 style="margin:0">📝 Assigned Assessments & Mock Tests</h3>
              <a routerLink="/student/tests" style="font-size:0.82rem;color:#4f46e5;font-weight:600">All Tests →</a>
            </div>
            @for (asg of data().assignedTests; track asg.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9">
                <div>
                  <div style="font-weight:700">{{ asg.test.title }}</div>
                  <div style="font-size:0.78rem;color:#64748b">
                    {{ asg.test.subject.name }} • {{ asg.durationMinutes }} mins • {{ asg.test.totalMarks }} Marks
                  </div>
                </div>
                <a [routerLink]="['/student/exam', asg.test.id]" class="btn btn-primary btn-sm">
                  {{ asg.attempts?.length ? 'Retake / Open' : 'Start Test' }}
                </a>
              </div>
            } @empty {
              <div class="empty-state"><p>No tests assigned yet.</p></div>
            }
          </div>

          <!-- Class Timetable -->
          <div class="card">
            <h3 style="margin-bottom:14px">🗓️ My Class Schedule & Timetable</h3>
            @for (slot of data().upcomingTimetable; track slot.id) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9">
                <div>
                  <span class="badge badge-info" style="margin-right:8px">{{ slot.dayOfWeek }}</span>
                  <strong>{{ slot.subject.name }}</strong>
                  <div style="font-size:0.78rem;color:#64748b;margin-top:3px">
                    {{ slot.topicNote || 'Concept Lecture' }} • {{ slot.teacher.user.firstName }} {{ slot.teacher.user.lastName }}
                  </div>
                </div>
                <div style="text-align:right;font-size:0.82rem;font-weight:600;color:#334155">
                  {{ slot.startTime }} - {{ slot.endTime }}<br />
                  <span style="font-size:0.74rem;color:#64748b">{{ slot.room }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Teacher Feedback & Announcements -->
        <div class="grid-2">
          <div class="card">
            <h3>🌟 Faculty Remarks & Action Plan</h3>
            @for (f of data().student.feedbacks; track f.id) {
              <div style="padding:10px 0;border-bottom:1px solid #f1f5f9">
                <div style="display:flex;justify-content:space-between">
                  <span class="badge badge-primary">{{ f.category }}</span>
                  <span style="font-weight:700;color:#d97706">★ {{ f.rating }}/5</span>
                </div>
                <p style="margin:6px 0 4px;font-size:0.88rem">{{ f.comment }}</p>
                @if (f.actionPlan) {
                  <div style="font-size:0.8rem;color:#4f46e5;font-weight:600">Action Plan: {{ f.actionPlan }}</div>
                }
              </div>
            } @empty {
              <p style="color:#64748b;font-size:0.86rem">No teacher remarks posted yet.</p>
            }
          </div>

          <div class="card">
            <h3>📢 Center Announcements</h3>
            @for (a of data().announcements; track a.id) {
              <div style="padding:10px 0;border-bottom:1px solid #f1f5f9">
                <strong style="font-size:0.9rem">{{ a.title }}</strong>
                <p style="margin:4px 0 0;font-size:0.82rem;color:#475569">{{ a.description }}</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class StudentDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly data = signal<any>(null);

  ngOnInit() {
    this.api.get('students/my-dashboard').subscribe((res) => this.data.set(res));
  }

  downloadMyReportCard() {
    const id = this.data()?.student?.id || 'me';
    this.api.downloadFile(`pdf/progress-report/${id}`, `My-Progress-Report-Card.pdf`);
  }
}

// ============================================================================
// 3. STUDENT ASSIGNED TESTS & PROFESSIONAL CBT EXAM INTERFACE
// ============================================================================
@Component({
  selector: 'app-student-tests-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Assigned Assessments & Mock Tests</h1>
          <p class="page-subtitle">Computer-Based Tests with auto-save recovery and instant objective evaluation</p>
        </div>
        <a routerLink="/student/results" class="btn btn-secondary">View My Results & Analytics →</a>
      </div>

      <div class="grid-2">
        @for (t of tests(); track t.id) {
          <div class="card card-hover">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <span class="badge badge-primary">{{ t.subject?.name }}</span>
              <span class="badge badge-neutral">{{ t.code }}</span>
            </div>
            <h3 style="margin:0 0 6px">{{ t.title }}</h3>
            <p style="font-size:0.86rem;color:#475569;margin-bottom:14px">{{ t.description }}</p>
            <div style="display:flex;gap:16px;font-size:0.82rem;color:#334155;margin-bottom:16px;flex-wrap:wrap">
              <span>⏱️ <strong>{{ t.durationMinutes }} Mins</strong></span>
              <span>🎯 <strong>{{ t.totalMarks }} Marks</strong></span>
              <span>❓ <strong>{{ t._count?.questions || 0 }} Questions</strong></span>
              <span>🔄 <strong>Max {{ t.maxAttempts }} Attempts</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #f1f5f9">
              @if (t.attempts?.length) {
                <span class="badge badge-success">
                  Last Score: {{ t.attempts[0].obtainedMarks }}/{{ t.totalMarks }} ({{ t.attempts[0].percentage }}%)
                </span>
              } @else {
                <span class="badge badge-warning">Not Attempted Yet</span>
              }
              <a [routerLink]="['/student/exam', t.id]" class="btn btn-primary btn-sm">
                {{ t.attempts?.length && t.attempts[0].status === 'IN_PROGRESS' ? 'Resume Saved Attempt' : 'Launch Assessment →' }}
              </a>
            </div>
          </div>
        } @empty {
          <div class="card empty-state" style="grid-column:1/-1">
            <span class="material-icons-outlined">assignment</span>
            <h4>No tests assigned yet</h4>
            <p>When your teachers assign an assessment to your batch, it will appear here.</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class StudentTestsListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly tests = signal<any[]>([]);

  ngOnInit() {
    this.api.get('tests').subscribe((res) => this.tests.set(res.items || []));
  }
}

@Component({
  selector: 'app-student-exam-interface',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      @if (examData()) {
        <!-- Top Exam Header with Live Timer & Auto-Save Indicator -->
        <div class="card exam-topbar">
          <div>
            <span class="badge badge-primary">{{ examData().test.subject?.name }}</span>
            <h2 style="margin:4px 0 0;font-size:1.25rem">{{ examData().test.title }}</h2>
            <div style="font-size:0.78rem;color:#64748b">
              Total Marks: {{ examData().test.totalMarks }} | Passing: {{ examData().test.passingMarks }} |
              Auto-saved: {{ lastSavedLabel() }}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:16px">
            <div class="timer-pill" [class.timer-urgent]="remainingSeconds() < 300">
              <span class="material-icons-outlined">timer</span>
              <span>{{ formatTimer(remainingSeconds()) }}</span>
            </div>
            <button class="btn btn-success" (click)="confirmSubmit()">Submit Final Test</button>
          </div>
        </div>

        <div class="exam-grid">
          <!-- Main Question Area -->
          <div class="card question-stage">
            @if (currentQuestion(); as q) {
              <div class="q-meta">
                <span><strong>Question {{ currentIndex() + 1 }} of {{ examData().questions.length }}</strong> ({{ q.type }})</span>
                <div>
                  <span class="badge badge-success">+{{ q.marks }} Marks</span>
                  @if (q.negativeMarks > 0) {
                    <span class="badge badge-danger" style="margin-left:6px">-{{ q.negativeMarks }} Negative</span>
                  }
                </div>
              </div>

              <div class="q-text">{{ q.questionText }}</div>

              <!-- MCQ Single / True-False -->
              @if (q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') {
                <div class="options-stack">
                  @for (opt of q.options; track opt.id) {
                    <label
                      class="option-tile"
                      [class.selected]="isOptionSelected(q.questionId, opt.id)"
                      (click)="selectSingleOption(q.questionId, opt.id)"
                    >
                      <input
                        type="radio"
                        [name]="'q_' + q.questionId"
                        [checked]="isOptionSelected(q.questionId, opt.id)"
                      />
                      <span>{{ opt.optionText }}</span>
                    </label>
                  }
                </div>
              }

              <!-- MCQ Multiple Select -->
              @if (q.type === 'MCQ_MULTIPLE') {
                <div class="options-stack">
                  @for (opt of q.options; track opt.id) {
                    <label
                      class="option-tile"
                      [class.selected]="isOptionSelected(q.questionId, opt.id)"
                    >
                      <input
                        type="checkbox"
                        [checked]="isOptionSelected(q.questionId, opt.id)"
                        (change)="toggleMultiOption(q.questionId, opt.id)"
                      />
                      <span>{{ opt.optionText }}</span>
                    </label>
                  }
                </div>
              }

              <!-- Numerical Answer -->
              @if (q.type === 'NUMERICAL') {
                <div class="form-group" style="max-width:320px;margin-top:16px">
                  <label>Enter Numerical Value Answer:</label>
                  <input
                    type="number"
                    step="any"
                    [ngModel]="answers()[q.questionId]?.numericalAnswer"
                    (ngModelChange)="setNumericalAnswer(q.questionId, $event)"
                    placeholder="e.g. 80"
                  />
                </div>
              }

              <!-- Short / Long Answer -->
              @if (q.type === 'SHORT_ANSWER' || q.type === 'LONG_ANSWER') {
                <div class="form-group" style="margin-top:16px">
                  <label>Write Your Answer:</label>
                  <textarea
                    rows="5"
                    [ngModel]="answers()[q.questionId]?.textAnswer || ''"
                    (ngModelChange)="setTextAnswer(q.questionId, $event)"
                    placeholder="Type your detailed analytical response..."
                  ></textarea>
                </div>
              }

              <!-- Question Action Controls -->
              <div class="q-controls">
                <div style="display:flex;gap:10px">
                  <button
                    class="btn btn-secondary"
                    [disabled]="currentIndex() === 0"
                    (click)="goToQuestion(currentIndex() - 1)"
                  >
                    ← Previous
                  </button>
                  <button class="btn btn-secondary" (click)="toggleReview(q.questionId)">
                    {{ answers()[q.questionId]?.isMarkedForReview ? '★ Unmark Review' : '☆ Mark for Review' }}
                  </button>
                </div>

                <div style="display:flex;gap:10px">
                  <button class="btn btn-secondary" (click)="triggerAutoSave(true)">💾 Save Answer</button>
                  @if (currentIndex() < examData().questions.length - 1) {
                    <button class="btn btn-primary" (click)="saveAndNext()">Save & Next →</button>
                  } @else {
                    <button class="btn btn-success" (click)="confirmSubmit()">Finish & Submit Test</button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Question Palette Sidebar -->
          <div class="card palette-panel">
            <h3 style="margin-bottom:8px">Question Palette</h3>
            <p style="font-size:0.78rem;color:#64748b;margin-bottom:14px">
              Click any number to jump directly to that question.
            </p>
            <div class="palette-grid">
              @for (q of examData().questions; track q.questionId; let idx = $index) {
                <button
                  type="button"
                  class="palette-btn"
                  [class.current]="currentIndex() === idx"
                  [class.answered]="isQuestionAnswered(q.questionId)"
                  [class.review]="answers()[q.questionId]?.isMarkedForReview"
                  (click)="goToQuestion(idx)"
                >
                  {{ idx + 1 }}
                </button>
              }
            </div>

            <div class="palette-legend">
              <div><span class="dot answered"></span> Answered</div>
              <div><span class="dot review"></span> Marked for Review</div>
              <div><span class="dot unanswered"></span> Unanswered</div>
            </div>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0" />
            <div style="font-size:0.82rem;color:#334155">
              <strong>Instructions:</strong>
              <p style="white-space:pre-line;font-size:0.78rem;color:#64748b;margin-top:6px">
                {{ examData().test.instructions }}
              </p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .exam-topbar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; flex-wrap: wrap; gap: 16px;
    }
    .timer-pill {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 18px; border-radius: 999px;
      background: #eef2ff; color: #312e81; font-weight: 800; font-size: 1.15rem;
      &.timer-urgent { background: #fef2f2; color: #dc2626; }
    }
    .exam-grid {
      display: grid; grid-template-columns: 1fr 310px; gap: 20px; align-items: start;
    }
    .q-meta {
      display: flex; justify-content: space-between; align-items: center;
      padding-bottom: 14px; border-bottom: 1px solid #f1f5f9; margin-bottom: 18px;
    }
    .q-text {
      font-size: 1.05rem; font-weight: 600; color: #0f172a; line-height: 1.6; margin-bottom: 20px;
    }
    .options-stack { display: flex; flex-direction: column; gap: 10px; }
    .option-tile {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      cursor: pointer; transition: all 0.15s;
      &:hover { background: #f8fafc; border-color: #cbd5e1; }
      &.selected { background: #eef2ff; border-color: #4f46e5; font-weight: 600; }
    }
    .q-controls {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 28px; padding-top: 18px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; gap: 12px;
    }
    .palette-grid {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
    }
    .palette-btn {
      height: 40px; border-radius: 8px; border: 1px solid #cbd5e1;
      background: #f8fafc; font-weight: 700; cursor: pointer;
      &.answered { background: #059669; color: #fff; border-color: #059669; }
      &.review { background: #7c3aed; color: #fff; border-color: #7c3aed; }
      &.current { outline: 3px solid #4f46e5; outline-offset: 1px; }
    }
    .palette-legend {
      display: flex; flex-direction: column; gap: 6px; margin-top: 16px; font-size: 0.78rem; color: #475569;
      div { display: flex; align-items: center; gap: 8px; }
      .dot { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
      .dot.answered { background: #059669; }
      .dot.review { background: #7c3aed; }
      .dot.unanswered { background: #f8fafc; border: 1px solid #cbd5e1; }
    }
    @media (max-width: 960px) {
      .exam-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class StudentExamInterfaceComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly examData = signal<any>(null);
  readonly currentIndex = signal(0);
  readonly answers = signal<Record<string, any>>({});
  readonly remainingSeconds = signal(1800);
  readonly elapsedSeconds = signal(0);
  readonly lastSavedLabel = signal('Just now');

  private timerHandle: any;
  private autoSaveHandle: any;
  private testId = '';

  currentQuestion() {
    const data = this.examData();
    if (!data || !data.questions?.length) return null;
    return data.questions[this.currentIndex()];
  }

  ngOnInit() {
    this.testId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.testId) return;

    this.api.post(`tests/${this.testId}/start`, {}).subscribe({
      next: (res) => {
        this.examData.set(res);
        // Merge server-recovered answers with any browser local backup
        const localBackupKey = `edunexus_exam_${res.attemptId}`;
        let localBackup = {};
        try {
          const raw = localStorage.getItem(localBackupKey);
          if (raw) localBackup = JSON.parse(raw);
        } catch {}

        this.answers.set({ ...(res.savedAnswers || {}), ...localBackup });
        const totalDurationSec = Number(res.test.durationMinutes || 45) * 60;
        const alreadySpent = Number(res.timeSpentSeconds || 0);
        this.elapsedSeconds.set(alreadySpent);
        this.remainingSeconds.set(Math.max(60, totalDurationSec - alreadySpent));

        this.startTimers();
      },
      error: () => {
        this.router.navigate(['/student/tests']);
      },
    });
  }

  private startTimers() {
    this.timerHandle = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
      this.remainingSeconds.update((rem) => {
        if (rem <= 1) {
          this.submitFinalTest();
          return 0;
        }
        return rem - 1;
      });
    }, 1000);

    // Periodic auto-save every 15 seconds
    this.autoSaveHandle = setInterval(() => {
      this.triggerAutoSave(false);
    }, 15000);
  }

  ngOnDestroy() {
    clearInterval(this.timerHandle);
    clearInterval(this.autoSaveHandle);
  }

  formatTimer(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private updateAnswerEntry(questionId: string, patch: any) {
    this.answers.update((curr) => {
      const existing = curr[questionId] || {
        questionId,
        selectedOptionIds: [],
        textAnswer: null,
        numericalAnswer: null,
        isMarkedForReview: false,
      };
      const next = { ...curr, [questionId]: { ...existing, ...patch } };
      const attemptId = this.examData()?.attemptId;
      if (attemptId) {
        localStorage.setItem(`edunexus_exam_${attemptId}`, JSON.stringify(next));
      }
      return next;
    });
  }

  isOptionSelected(questionId: string, optionId: string): boolean {
    const ids: string[] = this.answers()[questionId]?.selectedOptionIds || [];
    return ids.includes(optionId);
  }

  selectSingleOption(questionId: string, optionId: string) {
    this.updateAnswerEntry(questionId, { selectedOptionIds: [optionId] });
  }

  toggleMultiOption(questionId: string, optionId: string) {
    const currIds: string[] = this.answers()[questionId]?.selectedOptionIds || [];
    const nextIds = currIds.includes(optionId)
      ? currIds.filter((id) => id !== optionId)
      : [...currIds, optionId];
    this.updateAnswerEntry(questionId, { selectedOptionIds: nextIds });
  }

  setNumericalAnswer(questionId: string, val: any) {
    this.updateAnswerEntry(questionId, {
      numericalAnswer: val === '' || val === null ? null : Number(val),
    });
  }

  setTextAnswer(questionId: string, val: string) {
    this.updateAnswerEntry(questionId, { textAnswer: val });
  }

  toggleReview(questionId: string) {
    const curr = Boolean(this.answers()[questionId]?.isMarkedForReview);
    this.updateAnswerEntry(questionId, { isMarkedForReview: !curr });
  }

  isQuestionAnswered(questionId: string): boolean {
    const a = this.answers()[questionId];
    if (!a) return false;
    return (
      (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      (a.textAnswer && a.textAnswer.trim().length > 0) ||
      (a.numericalAnswer !== null && a.numericalAnswer !== undefined)
    );
  }

  goToQuestion(index: number) {
    this.currentIndex.set(index);
  }

  saveAndNext() {
    this.triggerAutoSave(false);
    if (this.currentIndex() < this.examData().questions.length - 1) {
      this.currentIndex.update((i) => i + 1);
    }
  }

  triggerAutoSave(notifyToast = false) {
    const data = this.examData();
    if (!data) return;
    const payload = {
      attemptId: data.attemptId,
      timeSpentSeconds: this.elapsedSeconds(),
      answers: Object.values(this.answers()),
    };
    this.api.post(`tests/${this.testId}/autosave`, payload).subscribe({
      next: () => {
        this.lastSavedLabel.set(new Date().toLocaleTimeString());
        if (notifyToast) {
          this.toast.success('Progress Saved', 'Your answers have been saved to the server.');
        }
      },
      error: () => {},
    });
  }

  confirmSubmit() {
    const total = this.examData()?.questions?.length || 0;
    const answered = this.examData()?.questions?.filter((q: any) =>
      this.isQuestionAnswered(q.questionId),
    ).length;

    this.toast.confirm({
      title: 'Submit Final Test?',
      message: `You have answered ${answered} out of ${total} questions. Once submitted, your objective responses will be evaluated immediately.`,
      confirmLabel: 'Yes, Submit Test',
      danger: false,
      onConfirm: () => this.submitFinalTest(),
    });
  }

  submitFinalTest() {
    clearInterval(this.timerHandle);
    clearInterval(this.autoSaveHandle);
    const data = this.examData();
    if (!data) return;

    this.api
      .post(`tests/${this.testId}/submit`, {
        attemptId: data.attemptId,
        timeSpentSeconds: this.elapsedSeconds(),
        answers: Object.values(this.answers()),
      })
      .subscribe({
        next: (result) => {
          localStorage.removeItem(`edunexus_exam_${data.attemptId}`);
          this.toast.success(
            'Assessment Evaluated!',
            `Score: ${result.obtainedMarks}/${result.totalMarks} (${result.percentage}%)`,
          );
          this.router.navigate(['/student/results']);
        },
      });
  }
}

// ============================================================================
// 4. STUDENT RESULTS & PERFORMANCE ANALYTICS PAGE
// ============================================================================
@Component({
  selector: 'app-student-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">My Test Results & Performance Analytics</h1>
          <p class="page-subtitle">Detailed subject mastery, topic-wise accuracy, improvement trends, and question explanations</p>
        </div>
        <button class="btn btn-primary" (click)="downloadProgressCard()">
          📄 Download Official Progress Report Card
        </button>
      </div>

      @if (analytics()) {
        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Overall Percentage</div>
              <div class="kpi-value">{{ analytics().overview.overallPercentage }}%</div>
              <div class="kpi-sub">Across {{ analytics().overview.testsAttempted }} evaluations</div>
            </div>
            <div class="kpi-icon"><span class="material-icons-outlined">insights</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Overall Accuracy</div>
              <div class="kpi-value">{{ analytics().overview.overallAccuracy }}%</div>
              <div class="kpi-sub">Correct vs attempted ratio</div>
            </div>
            <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">check_circle</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Best Score</div>
              <div class="kpi-value">{{ analytics().overview.bestScore }}%</div>
              <div class="kpi-sub">Peak performance</div>
            </div>
            <div class="kpi-icon" style="background:#fffbeb;color:#d97706"><span class="material-icons-outlined">emoji_events</span></div>
          </div>
        </div>

        <div class="grid-2" style="margin-bottom:24px">
          <div class="card">
            <h3>Subject-Wise Mastery</h3>
            @for (sp of analytics().subjectPerformance; track sp.subject) {
              <div style="margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;font-size:0.88rem;margin-bottom:6px">
                  <strong>{{ sp.subject }} ({{ sp.testsCount }} tests)</strong>
                  <span>Score: <strong>{{ sp.percentage }}%</strong> | Accuracy: {{ sp.accuracy }}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" [style.width.%]="sp.percentage" [style.background]="sp.color"></div>
                </div>
              </div>
            }
          </div>

          <div class="card">
            <h3>Topic-Wise Strengths & Focus Areas</h3>
            @for (tp of analytics().topicPerformance; track tp.topic) {
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:0.86rem">
                <span>{{ tp.topic }}</span>
                <span class="badge" [class.badge-success]="tp.percentage >= 75" [class.badge-warning]="tp.percentage < 75">
                  {{ tp.correct }}/{{ tp.total }} ({{ tp.percentage }}%)
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Results Table -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Test Title</th>
              <th>Subject</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Accuracy</th>
              <th>Time Taken</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (r of results(); track r.id) {
              <tr>
                <td>
                  <div style="font-weight:700">{{ r.test.title }}</div>
                  <div style="font-size:0.76rem;color:#64748b">{{ r.publishedAt | date:'mediumDate' }}</div>
                </td>
                <td><span class="badge badge-primary">{{ r.subject.name }}</span></td>
                <td><strong>{{ r.obtainedMarks }} / {{ r.totalMarks }}</strong></td>
                <td><strong>{{ r.percentage }}%</strong></td>
                <td>{{ r.accuracy }}%</td>
                <td>{{ Math.floor(r.timeTakenSeconds / 60) }}m {{ r.timeTakenSeconds % 60 }}s</td>
                <td>
                  <span class="badge" [class.badge-success]="r.isPassed" [class.badge-danger]="!r.isPassed">
                    {{ r.isPassed ? 'PASSED' : 'NEEDS REVIEW' }}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-sm" (click)="inspectResult(r.id)">Question Review</button>
                    <button class="btn btn-primary btn-sm" (click)="downloadSingleScorecard(r)">PDF</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Detailed Question-wise Result & Explanation Modal/Card -->
      @if (selectedResult()) {
        <div class="card" style="margin-top:24px;border:2px solid #4f46e5">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div>
              <h2 style="margin:0">{{ selectedResult().test.title }} — Question-by-Question Review</h2>
              <p style="margin:4px 0 0;color:#64748b">
                Obtained: <strong>{{ selectedResult().obtainedMarks }}/{{ selectedResult().totalMarks }} ({{ selectedResult().percentage }}%)</strong> |
                Correct: {{ selectedResult().correctCount }} | Incorrect: {{ selectedResult().incorrectCount }} | Unanswered: {{ selectedResult().unansweredCount }}
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" (click)="selectedResult.set(null)">Close Review ✕</button>
          </div>

          @for (qr of selectedResult().questionResults; track qr.questionId; let idx = $index) {
            <div style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong>Q{{ idx + 1 }}. {{ qr.questionText }}</strong>
                <span class="badge" [class.badge-success]="qr.isCorrect" [class.badge-danger]="qr.isCorrect === false">
                  {{ qr.marksAwarded }} / {{ qr.maxMarks }} Marks
                </span>
              </div>
              @if (qr.explanation) {
                <div style="background:#f8fafc;padding:10px;border-radius:8px;font-size:0.84rem;color:#1e40af;margin-top:8px">
                  <strong>Explanation:</strong> {{ qr.explanation }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StudentResultsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly results = signal<any[]>([]);
  readonly analytics = signal<any>(null);
  readonly selectedResult = signal<any>(null);
  readonly Math = Math;

  ngOnInit() {
    this.api.get('results').subscribe((res) => this.results.set(res.items || []));
    this.api.get('reports/student-analytics/me').subscribe({
      next: (res) => this.analytics.set(res),
      error: () => {},
    });
  }

  inspectResult(id: string) {
    this.api.get(`results/${id}`).subscribe((res) => this.selectedResult.set(res));
  }

  downloadSingleScorecard(r: any) {
    this.api.downloadFile(`pdf/result/${r.id}`, `Result-${r.test.code}.pdf`);
  }

  downloadProgressCard() {
    this.api.downloadFile('pdf/progress-report/me', 'Student-Progress-Report-Card.pdf');
  }
}

// ============================================================================
// 5. PARENT DASHBOARD WITH MULTI-CHILD SWITCHER
// ============================================================================
@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      @if (data()) {
        <div class="page-header">
          <div>
            <h1 class="page-title">Parent & Guardian Academic Portal</h1>
            <p class="page-subtitle">
              Monitoring Child:
              <strong>{{ data().activeChild?.user?.firstName }} {{ data().activeChild?.user?.lastName }}</strong>
              ({{ data().activeChild?.studentCode }} • {{ data().activeChild?.grade }})
            </p>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <!-- Child Switcher Pills -->
            @for (child of data().children; track child.id) {
              <button
                class="btn btn-sm"
                [class.btn-primary]="child.id === data().activeChild?.id"
                [class.btn-secondary]="child.id !== data().activeChild?.id"
                (click)="selectChild(child.id)"
              >
                👤 {{ child.user.firstName }} ({{ child.grade }})
              </button>
            }
            <button class="btn btn-primary btn-sm" (click)="downloadChildReport()">
              📄 Download Child PDF Report Card
            </button>
            <a routerLink="/messages" class="btn btn-secondary btn-sm">💬 Message Teacher</a>
          </div>
        </div>

        @if (data().activeChild; as child) {
          <div class="kpi-grid">
            <div class="kpi-card">
              <div>
                <div class="kpi-label">Attendance Percentage</div>
                <div class="kpi-value">{{ child.summary.attendancePercentage }}%</div>
                <div class="kpi-sub">{{ child.summary.presentCount }}/{{ child.summary.totalAttendance }} Classes Attended</div>
              </div>
              <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">event_available</span></div>
            </div>
            <div class="kpi-card">
              <div>
                <div class="kpi-label">Average Test Score</div>
                <div class="kpi-value">{{ child.summary.averagePercentage }}%</div>
                <div class="kpi-sub">Across {{ child.summary.totalTestsTaken }} Assessments</div>
              </div>
              <div class="kpi-icon"><span class="material-icons-outlined">insights</span></div>
            </div>
            <div class="kpi-card">
              <div>
                <div class="kpi-label">Highest Test Score</div>
                <div class="kpi-value">{{ child.summary.bestPercentage }}%</div>
                <div class="kpi-sub">Target: {{ child.targetExam }}</div>
              </div>
              <div class="kpi-icon" style="background:#fffbeb;color:#d97706"><span class="material-icons-outlined">emoji_events</span></div>
            </div>
          </div>

          <div class="grid-2" style="margin-bottom:24px">
            <div class="card">
              <h3>📊 Recent Assessment Scores ({{ child.user.firstName }})</h3>
              @for (r of child.results; track r.id) {
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9">
                  <div>
                    <div style="font-weight:700">{{ r.test.title }}</div>
                    <div style="font-size:0.78rem;color:#64748b">
                      {{ r.subject.name }} • {{ r.publishedAt | date:'mediumDate' }}
                    </div>
                  </div>
                  <div style="text-align:right">
                    <span class="badge badge-success">{{ r.obtainedMarks }}/{{ r.totalMarks }} ({{ r.percentage }}%)</span>
                    <div style="font-size:0.74rem;color:#64748b;margin-top:3px">Accuracy: {{ r.accuracy }}%</div>
                  </div>
                </div>
              } @empty {
                <p style="color:#64748b">No test results published yet for {{ child.user.firstName }}.</p>
              }
            </div>

            <div class="card">
              <h3>🌟 Teacher Feedback & Observations</h3>
              @for (f of child.feedbacks; track f.id) {
                <div style="padding:12px 0;border-bottom:1px solid #f1f5f9">
                  <div style="display:flex;justify-content:space-between">
                    <span class="badge badge-primary">{{ f.category }}</span>
                    <span style="font-size:0.8rem;font-weight:700">by {{ f.teacher.user.firstName }} {{ f.teacher.user.lastName }}</span>
                  </div>
                  <p style="margin:6px 0;font-size:0.88rem">{{ f.comment }}</p>
                  @if (f.actionPlan) {
                    <div style="font-size:0.8rem;color:#4f46e5;font-weight:600">Action Plan: {{ f.actionPlan }}</div>
                  }
                </div>
              } @empty {
                <p style="color:#64748b">No faculty feedback notes recorded yet.</p>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class ParentDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly data = signal<any>(null);

  constructor() {
    effect(() => {
      const childId = this.auth.selectedChildId();
      if (childId) {
        this.loadDashboard(childId);
      }
    });
  }

  ngOnInit() {
    this.loadDashboard(this.auth.selectedChildId() || undefined);
  }

  selectChild(studentId: string) {
    this.auth.selectedChildId.set(studentId);
  }

  loadDashboard(studentId?: string) {
    this.api.get('parents/my-dashboard', { studentId }).subscribe((res) => {
      this.data.set(res);
    });
  }

  downloadChildReport() {
    const child = this.data()?.activeChild;
    if (!child) return;
    this.api.downloadFile(
      `pdf/progress-report/${child.id}`,
      `Progress-Report-${child.studentCode}.pdf`,
    );
  }
}
