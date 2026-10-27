import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RealtimeService } from '../../core/services/realtime.service';

// ============================================================================
// 1. QUESTION BANK & HIERARCHY / BULK CSV IMPORT COMPONENT
// ============================================================================
@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Question Bank & Item Repository</h1>
          <p class="page-subtitle">Organize by Subject → Chapter → Topic → Difficulty, bulk import via CSV, and track item accuracy</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary" (click)="activeTab.set(activeTab() === 'IMPORT' ? 'LIST' : 'IMPORT')">
            📥 Bulk CSV Import
          </button>
          <button class="btn btn-primary" (click)="activeTab.set(activeTab() === 'CREATE' ? 'LIST' : 'CREATE')">
            {{ activeTab() === 'CREATE' ? 'Back to Question Bank' : '+ Create Question' }}
          </button>
        </div>
      </div>

      <!-- Create Question Form -->
      @if (activeTab() === 'CREATE') {
        <div class="card" style="margin-bottom:24px">
          <h3>Author New Question</h3>
          <form (ngSubmit)="saveQuestion()">
            <div class="form-grid">
              <div class="form-group">
                <label>Question Type <span class="req">*</span></label>
                <select [(ngModel)]="qForm.type" name="type">
                  <option value="MCQ_SINGLE">Multiple Choice (Single Correct)</option>
                  <option value="MCQ_MULTIPLE">Multiple Select (More than one correct)</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="NUMERICAL">Numerical Value</option>
                  <option value="SHORT_ANSWER">Short Answer</option>
                  <option value="LONG_ANSWER">Long Answer</option>
                </select>
              </div>
              <div class="form-group">
                <label>Subject <span class="req">*</span></label>
                <select [(ngModel)]="qForm.subjectId" name="subjectId" (ngModelChange)="onSubjectChange($event)" required>
                  @for (s of subjects(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Chapter</label>
                <select [(ngModel)]="qForm.chapterId" name="chapterId">
                  <option value="">-- Optional Chapter --</option>
                  @for (ch of currentChapters(); track ch.id) {
                    <option [value]="ch.id">{{ ch.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Difficulty</label>
                <select [(ngModel)]="qForm.difficulty" name="difficulty">
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div class="form-group">
                <label>Positive Marks</label>
                <input type="number" [(ngModel)]="qForm.marks" name="marks" />
              </div>
              <div class="form-group">
                <label>Negative Marks</label>
                <input type="number" step="0.25" [(ngModel)]="qForm.negativeMarks" name="negativeMarks" />
              </div>
            </div>

            <div class="form-group">
              <label>Question Stem / Statement <span class="req">*</span></label>
              <textarea rows="3" [(ngModel)]="qForm.questionText" name="questionText" required placeholder="Enter complete question statement..."></textarea>
            </div>

            @if (qForm.type === 'MCQ_SINGLE' || qForm.type === 'MCQ_MULTIPLE') {
              <div style="margin-bottom:16px">
                <label style="font-size:0.84rem;font-weight:700;display:block;margin-bottom:8px">Options (Check the box for correct option(s)):</label>
                @for (opt of qForm.options; track $index; let idx = $index) {
                  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
                    <input type="checkbox" [(ngModel)]="opt.isCorrect" [name]="'opt_corr_' + idx" />
                    <input
                      type="text"
                      [(ngModel)]="opt.optionText"
                      [name]="'opt_txt_' + idx"
                      placeholder="Option text..."
                      style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px"
                    />
                  </div>
                }
              </div>
            }

            @if (qForm.type === 'NUMERICAL') {
              <div class="form-group" style="max-width:300px">
                <label>Exact Numerical Answer <span class="req">*</span></label>
                <input type="number" step="any" [(ngModel)]="qForm.numericalAnswer" name="numericalAnswer" />
              </div>
            }

            @if (qForm.type === 'TRUE_FALSE' || qForm.type === 'SHORT_ANSWER' || qForm.type === 'LONG_ANSWER') {
              <div class="form-group">
                <label>Correct / Reference Answer</label>
                <input type="text" [(ngModel)]="qForm.correctTextAnswer" name="correctTextAnswer" placeholder="TRUE / FALSE or reference key" />
              </div>
            }

            <div class="form-grid">
              <div class="form-group">
                <label>Step-by-Step Solution / Explanation</label>
                <input type="text" [(ngModel)]="qForm.explanation" name="explanation" placeholder="Shown to students after test based on visibility settings" />
              </div>
              <div class="form-group">
                <label>Tags (comma separated)</label>
                <input type="text" [(ngModel)]="qForm.tags" name="tags" placeholder="e.g. mechanics, newton-laws, jee-main" />
              </div>
            </div>

            <div style="display:flex;gap:10px">
              <button type="submit" class="btn btn-primary">Save Question to Bank</button>
              <button type="button" class="btn btn-secondary" (click)="activeTab.set('LIST')">Cancel</button>
            </div>
          </form>
        </div>
      }

      <!-- Bulk CSV Import View -->
      @if (activeTab() === 'IMPORT') {
        <div class="card" style="margin-bottom:24px">
          <h3>Bulk CSV Question Import with Validation</h3>
          <p style="font-size:0.85rem;color:#475569">
            Format per line: <code>QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption(A/B/C/D),Marks,NegativeMarks,Difficulty,Explanation</code>
          </p>
          <div class="form-group" style="max-width:320px">
            <label>Target Subject</label>
            <select [(ngModel)]="qForm.subjectId">
              @for (s of subjects(); track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label>Paste CSV Rows</label>
            <textarea rows="5" [(ngModel)]="csvText"></textarea>
          </div>
          <button class="btn btn-primary" (click)="runBulkImport()">Validate & Import Questions</button>
        </div>
      }

      <!-- Filter & Search Bar -->
      <div class="card" style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap">
        <input
          type="text"
          placeholder="Search question text, explanation, or tags..."
          [(ngModel)]="search"
          (ngModelChange)="loadQuestions()"
          style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;min-width:220px"
        />
        <select [(ngModel)]="subjectFilter" (ngModelChange)="loadQuestions()" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="">All Subjects</option>
          @for (s of subjects(); track s.id) {
            <option [value]="s.id">{{ s.name }}</option>
          }
        </select>
        <select [(ngModel)]="difficultyFilter" (ngModelChange)="loadQuestions()" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px">
          <option value="">All Difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>

      <!-- Questions List -->
      @for (q of questions(); track q.id) {
        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="badge badge-primary">{{ q.subject?.name }}</span>
              @if (q.chapter) { <span class="badge badge-neutral">{{ q.chapter.name }}</span> }
              <span
                class="badge"
                [class.badge-success]="q.difficulty === 'EASY'"
                [class.badge-warning]="q.difficulty === 'MEDIUM'"
                [class.badge-danger]="q.difficulty === 'HARD'"
              >{{ q.difficulty }}</span>
              <span class="badge badge-info">{{ q.type }} (+{{ q.marks }} / -{{ q.negativeMarks }})</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:0.76rem;color:#64748b">
                Used {{ q.timesUsed }}x • Accuracy: <strong>{{ q.correctPercentage }}%</strong>
              </span>
              <button class="btn btn-secondary btn-sm" (click)="duplicateQuestion(q.id)">Duplicate</button>
              <button class="btn btn-danger btn-sm" (click)="deleteQuestion(q)">Delete</button>
            </div>
          </div>

          <div style="font-weight:600;font-size:0.96rem;margin-bottom:10px">{{ q.questionText }}</div>

          @if (q.options?.length) {
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-bottom:8px">
              @for (opt of q.options; track opt.id) {
                <div
                  style="padding:6px 10px;border-radius:6px;font-size:0.84rem;border:1px solid #e2e8f0"
                  [style.background]="opt.isCorrect ? '#ecfdf5' : '#f8fafc'"
                  [style.borderColor]="opt.isCorrect ? '#10b981' : '#e2e8f0'"
                >
                  {{ opt.isCorrect ? '✓ ' : '' }}{{ opt.optionText }}
                </div>
              }
            </div>
          }

          @if (q.explanation) {
            <div style="font-size:0.8rem;color:#475569;background:#f8fafc;padding:8px 12px;border-radius:6px">
              <strong>Solution:</strong> {{ q.explanation }}
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class QuestionBankComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'LIST' | 'CREATE' | 'IMPORT'>('LIST');
  readonly questions = signal<any[]>([]);
  readonly subjects = signal<any[]>([]);
  readonly currentChapters = signal<any[]>([]);

  search = '';
  subjectFilter = '';
  difficultyFilter = '';

  csvText =
    'QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectOption,Marks,NegativeMarks,Difficulty,Explanation\n' +
    'What is the escape velocity from Earth surface?,MCQ_SINGLE,11.2 km/s,9.8 km/s,7.9 km/s,15.0 km/s,A,4,1,EASY,Using v = sqrt(2gR) = 11.2 km/s';

  qForm: any = {
    type: 'MCQ_SINGLE',
    subjectId: '',
    chapterId: '',
    difficulty: 'MEDIUM',
    marks: 4,
    negativeMarks: 1,
    questionText: '',
    explanation: '',
    tags: 'mechanics, concept',
    numericalAnswer: null,
    correctTextAnswer: 'TRUE',
    options: [
      { optionText: '', isCorrect: true },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false },
    ],
  };

  ngOnInit() {
    this.api.get('subjects').subscribe((res) => {
      this.subjects.set(res || []);
      if (res?.length) {
        this.qForm.subjectId = res[0].id;
        this.currentChapters.set(res[0].chapters || []);
      }
    });
    this.loadQuestions();
  }

  onSubjectChange(subjectId: string) {
    const subj = this.subjects().find((s) => s.id === subjectId);
    this.currentChapters.set(subj?.chapters || []);
  }

  loadQuestions() {
    this.api
      .get('questions', {
        search: this.search,
        subjectId: this.subjectFilter,
        difficulty: this.difficultyFilter,
        limit: 50,
      })
      .subscribe((res) => this.questions.set(res.items || []));
  }

  saveQuestion() {
    if (!this.qForm.questionText || !this.qForm.subjectId) return;
    this.api.post('questions', this.qForm).subscribe(() => {
      this.toast.success('Question Created', 'Added to Question Bank.');
      this.activeTab.set('LIST');
      this.loadQuestions();
    });
  }

  runBulkImport() {
    if (!this.csvText.trim() || !this.qForm.subjectId) return;
    this.api
      .post('questions/bulk-import', {
        subjectId: this.qForm.subjectId,
        csvContent: this.csvText,
      })
      .subscribe((res) => {
        this.toast.success(
          'Bulk Import Complete',
          `Imported ${res.importedCount} questions (${res.failedCount} failed).`,
        );
        this.activeTab.set('LIST');
        this.loadQuestions();
      });
  }

  duplicateQuestion(id: string) {
    this.api.post(`questions/${id}/duplicate`).subscribe(() => {
      this.toast.success('Question Duplicated', 'Copy created in Question Bank.');
      this.loadQuestions();
    });
  }

  deleteQuestion(q: any) {
    this.toast.confirm({
      title: 'Delete Question?',
      message: 'Are you sure you want to delete this question from the Question Bank?',
      confirmLabel: 'Delete Question',
      danger: true,
      onConfirm: () => {
        this.api.delete(`questions/${q.id}`).subscribe(() => {
          this.toast.success('Deleted', 'Question removed.');
          this.loadQuestions();
        });
      },
    });
  }
}

// ============================================================================
// 2. TEST CREATION (MANUAL + AUTOMATIC GENERATOR), ASSIGNMENT & PDF EXPORT
// ============================================================================
@Component({
  selector: 'app-test-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Tests, Assessment Wizard & Branded PDFs</h1>
          <p class="page-subtitle">Create manual or auto-generated tests, preview before publishing, assign to batches, and export PDFs</p>
        </div>
        <button class="btn btn-primary" (click)="showWizard.set(!showWizard())">
          {{ showWizard() ? 'Close Test Wizard' : '+ Create New Test' }}
        </button>
      </div>

      @if (showWizard()) {
        <div class="card" style="margin-bottom:24px;border:2px solid #4f46e5">
          <h3>Create & Configure Assessment</h3>
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="wizard.generationMode === 'AUTOMATIC'"
              [class.btn-secondary]="wizard.generationMode !== 'AUTOMATIC'"
              (click)="wizard.generationMode = 'AUTOMATIC'"
            >
              ⚡ Automatic Test Generator (By Criteria)
            </button>
            <button
              type="button"
              class="btn btn-sm"
              [class.btn-primary]="wizard.generationMode === 'MANUAL'"
              [class.btn-secondary]="wizard.generationMode !== 'MANUAL'"
              (click)="wizard.generationMode = 'MANUAL'"
            >
              ✋ Manual Question Selection
            </button>
          </div>

          <form (ngSubmit)="createTest()">
            <div class="form-grid">
              <div class="form-group">
                <label>Test Title <span class="req">*</span></label>
                <input type="text" [(ngModel)]="wizard.title" name="title" required placeholder="e.g. JEE 2027 Part Test 2: Electrodynamics" />
              </div>
              <div class="form-group">
                <label>Assign to Class / Batch</label>
                <select [(ngModel)]="wizard.classBatchId" name="classBatchId">
                  <option value="">-- Select Batch --</option>
                  @for (c of classes(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Subject <span class="req">*</span></label>
                <select [(ngModel)]="wizard.subjectId" name="subjectId" (ngModelChange)="loadSubjectQuestions($event)" required>
                  @for (s of subjects(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Duration (Minutes)</label>
                <input type="number" [(ngModel)]="wizard.durationMinutes" name="durationMinutes" />
              </div>
              <div class="form-group">
                <label>Difficulty Filter</label>
                <select [(ngModel)]="wizard.difficulty" name="difficulty">
                  <option value="MIXED">Mixed (All Difficulties)</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div class="form-group">
                <label>Answer Visibility</label>
                <select [(ngModel)]="wizard.answerVisibility" name="answerVisibility">
                  <option value="IMMEDIATE">Immediate After Submission</option>
                  <option value="AFTER_TEST_CLOSE">After Test Window Closes</option>
                  <option value="MANUAL">Manual Release by Teacher</option>
                </select>
              </div>
            </div>

            @if (wizard.generationMode === 'AUTOMATIC') {
              <div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:14px">
                <div class="form-group" style="margin:0">
                  <label>Number of Questions to Auto-Select</label>
                  <input type="number" min="1" max="50" [(ngModel)]="wizard.questionCount" name="questionCount" />
                </div>
                <div class="form-group" style="margin:0">
                  <label>Marks per Question</label>
                  <input type="number" [(ngModel)]="wizard.marksPerQuestion" name="marksPerQuestion" />
                </div>
              </div>
            } @else {
              <div style="background:#f8fafc;padding:14px;border-radius:10px;margin-bottom:14px;max-height:240px;overflow-y:auto">
                <strong style="display:block;margin-bottom:8px;font-size:0.85rem">Select Questions from Question Bank:</strong>
                @for (q of bankQuestions(); track q.id) {
                  <label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:0.84rem;border-bottom:1px solid #e2e8f0">
                    <input
                      type="checkbox"
                      [checked]="selectedQuestionIds().includes(q.id)"
                      (change)="toggleQuestionSelection(q.id)"
                    />
                    <span>[{{ q.difficulty }}] {{ q.questionText }} (+{{ q.marks }}m)</span>
                  </label>
                }
              </div>
            }

            <div style="display:flex;gap:18px;margin-bottom:16px;flex-wrap:wrap;font-size:0.86rem">
              <label><input type="checkbox" [(ngModel)]="wizard.negativeMarkingEnabled" name="neg" /> Enable Negative Marking</label>
              <label><input type="checkbox" [(ngModel)]="wizard.randomizeQuestions" name="randQ" /> Randomize Question Order</label>
              <label><input type="checkbox" [(ngModel)]="wizard.showRankings" name="rank" /> Show Student Rank on Scorecard</label>
            </div>

            <button type="submit" class="btn btn-primary">Create, Publish & Assign Test</button>
          </form>
        </div>
      }

      <!-- Tests Table -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Test Title & Code</th>
              <th>Subject & Batch</th>
              <th>Config</th>
              <th>Status</th>
              <th>Branded PDF & Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (t of tests(); track t.id) {
              <tr>
                <td>
                  <div style="font-weight:700">{{ t.title }}</div>
                  <div style="font-size:0.76rem;color:#64748b">{{ t.code }} • {{ t.generationMode }}</div>
                </td>
                <td>
                  <span class="badge badge-primary">{{ t.subject?.name }}</span>
                  <div style="font-size:0.78rem;color:#475569;margin-top:3px">{{ t.classBatch?.name || 'All Batches' }}</div>
                </td>
                <td>
                  {{ t._count?.questions || 0 }} Qs • {{ t.totalMarks }} Marks • {{ t.durationMinutes }} Mins
                </td>
                <td>
                  <span class="badge badge-success">{{ t.status }}</span>
                  <div style="font-size:0.75rem;color:#64748b;margin-top:2px">{{ t._count?.attempts || 0 }} Attempts</div>
                </td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-secondary btn-sm" (click)="previewTest(t.id)">Preview</button>
                    <button class="btn btn-primary btn-sm" (click)="downloadTestPaper(t)">📄 Question Paper PDF</button>
                    <button class="btn btn-secondary btn-sm" (click)="downloadAnswerKey(t)">🔑 Answer Key PDF</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Test Preview Modal -->
      @if (previewedTest()) {
        <div class="card" style="margin-top:24px;border:2px solid #0891b2">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="margin:0">Test Preview: {{ previewedTest().title }} ({{ previewedTest().totalMarks }} Marks)</h3>
            <button class="btn btn-secondary btn-sm" (click)="previewedTest.set(null)">Close Preview ✕</button>
          </div>
          @for (tq of previewedTest().questions; track tq.id; let i = $index) {
            <div style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:0.88rem">
              <strong>Q{{ i + 1 }}. {{ tq.question.questionText }}</strong> (+{{ tq.marks }} / -{{ tq.negativeMarks }})
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TestManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly tests = signal<any[]>([]);
  readonly subjects = signal<any[]>([]);
  readonly classes = signal<any[]>([]);
  readonly bankQuestions = signal<any[]>([]);
  readonly selectedQuestionIds = signal<string[]>([]);
  readonly showWizard = signal(false);
  readonly previewedTest = signal<any>(null);

  wizard: any = {
    title: '',
    subjectId: '',
    classBatchId: '',
    durationMinutes: 45,
    difficulty: 'MIXED',
    generationMode: 'AUTOMATIC',
    questionCount: 5,
    marksPerQuestion: 4,
    negativeMarkingEnabled: true,
    randomizeQuestions: false,
    showRankings: false,
    answerVisibility: 'IMMEDIATE',
  };

  ngOnInit() {
    this.loadTests();
    this.api.get('classes').subscribe((res) => {
      this.classes.set(res || []);
      if (res?.length) this.wizard.classBatchId = res[0].id;
    });
    this.api.get('subjects').subscribe((res) => {
      this.subjects.set(res || []);
      if (res?.length) {
        this.wizard.subjectId = res[0].id;
        this.loadSubjectQuestions(res[0].id);
      }
    });
  }

  loadTests() {
    this.api.get('tests').subscribe((res) => this.tests.set(res.items || []));
  }

  loadSubjectQuestions(subjectId: string) {
    this.api.get('questions', { subjectId, limit: 50 }).subscribe((res) => {
      this.bankQuestions.set(res.items || []);
    });
  }

  toggleQuestionSelection(id: string) {
    this.selectedQuestionIds.update((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  }

  createTest() {
    if (!this.wizard.title || !this.wizard.subjectId) return;
    const payload = {
      ...this.wizard,
      questionIds: this.wizard.generationMode === 'MANUAL' ? this.selectedQuestionIds() : undefined,
    };
    this.api.post('tests', payload).subscribe((created) => {
      this.toast.success('Test Published & Assigned', `Created "${created.title}"`);
      this.showWizard.set(false);
      this.loadTests();
    });
  }

  previewTest(id: string) {
    this.api.get(`tests/${id}`).subscribe((res) => this.previewedTest.set(res));
  }

  downloadTestPaper(t: any) {
    this.api.downloadFile(`pdf/test-paper/${t.id}`, `Question-Paper-${t.code}.pdf`);
  }

  downloadAnswerKey(t: any) {
    this.api.downloadFile(`pdf/answer-key/${t.id}`, `Answer-Key-${t.code}.pdf`);
  }
}

// ============================================================================
// 3. CLASSES / BATCHES & TIMETABLE MANAGEMENT COMPONENT
// ============================================================================
@Component({
  selector: 'app-classes-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Classes, Batches & Academic Timetable</h1>
          <p class="page-subtitle">Manage batch rosters, faculty allocations, and weekly class schedules</p>
        </div>
        @if (auth.userRole() !== 'STUDENT' && auth.userRole() !== 'PARENT') {
          <button class="btn btn-primary" (click)="showCreate.set(!showCreate())">
            {{ showCreate() ? 'Close Form' : '+ Create Class / Batch' }}
          </button>
        }
      </div>

      @if (showCreate()) {
        <div class="card" style="margin-bottom:24px">
          <h3>Create New Class / Batch</h3>
          <form (ngSubmit)="createBatch()">
            <div class="form-grid">
              <div class="form-group">
                <label>Batch Name <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.name" name="name" required placeholder="e.g. JEE 2027 Batch B" />
              </div>
              <div class="form-group">
                <label>Grade / Target</label>
                <input type="text" [(ngModel)]="form.grade" name="grade" placeholder="Class 12" />
              </div>
              <div class="form-group">
                <label>Schedule Summary</label>
                <input type="text" [(ngModel)]="form.scheduleSummary" name="scheduleSummary" placeholder="Mon-Sat 9:00 AM - 1:00 PM" />
              </div>
              <div class="form-group">
                <label>Lecture Room</label>
                <input type="text" [(ngModel)]="form.room" name="room" placeholder="Lecture Hall 103" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Create Batch</button>
          </form>
        </div>
      }

      <div class="grid-3" style="margin-bottom:24px">
        @for (c of classes(); track c.id) {
          <div class="card">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span class="badge badge-primary">{{ c.code }}</span>
              <span class="badge badge-success">{{ c.status }}</span>
            </div>
            <h3 style="margin:0 0 4px">{{ c.name }}</h3>
            <p style="font-size:0.84rem;color:#475569;margin-bottom:10px">{{ c.scheduleSummary }} • {{ c.room }}</p>
            <div style="font-size:0.82rem;color:#334155">
              <strong>Students Enrolled:</strong> {{ c._count?.students || 0 }} / {{ c.capacity }}<br />
              <strong>Tests Conducted:</strong> {{ c._count?.tests || 0 }}
            </div>
          </div>
        }
      </div>

      <div class="card">
        <h3>🗓️ Weekly Master Timetable</h3>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Class / Batch</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Room & Topic</th>
              </tr>
            </thead>
            <tbody>
              @for (slot of timetable(); track slot.id) {
                <tr>
                  <td><span class="badge badge-info">{{ slot.dayOfWeek }}</span></td>
                  <td><strong>{{ slot.startTime }} – {{ slot.endTime }}</strong></td>
                  <td>{{ slot.classBatch?.name }}</td>
                  <td><span class="badge badge-primary">{{ slot.subject?.name }}</span></td>
                  <td>{{ slot.teacher?.user?.firstName }} {{ slot.teacher?.user?.lastName }}</td>
                  <td>{{ slot.room }} • {{ slot.topicNote || 'Lecture' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ClassesAndTimetableComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly classes = signal<any[]>([]);
  readonly timetable = signal<any[]>([]);
  readonly showCreate = signal(false);

  form = {
    name: '',
    grade: 'Class 12',
    scheduleSummary: 'Mon - Sat • 09:00 AM - 01:00 PM',
    room: 'Hall 104',
  };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.get('classes').subscribe((res) => this.classes.set(res || []));
    this.api.get('timetable').subscribe((res) => this.timetable.set(res || []));
  }

  createBatch() {
    if (!this.form.name) return;
    this.api.post('classes', this.form).subscribe(() => {
      this.toast.success('Batch Created', `Created ${this.form.name}`);
      this.showCreate.set(false);
      this.loadData();
    });
  }
}

// ============================================================================
// 4. ATTENDANCE MANAGEMENT & REPORTS COMPONENT
// ============================================================================
@Component({
  selector: 'app-attendance-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Attendance Management & Analytics</h1>
          <p class="page-subtitle">
            @if (isStaff()) {
              Mark daily batch attendance, bulk-mark present, and export attendance reports
            } @else {
              Track monthly attendance percentage and session-wise presence history
            }
          </p>
        </div>
        @if (isStaff()) {
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" (click)="exportCsv()">Export CSV</button>
            <button class="btn btn-primary btn-sm" (click)="exportPdf()">📄 Branded PDF Report</button>
          </div>
        }
      </div>

      @if (isStaff()) {
        <!-- Staff Attendance Marker -->
        <div class="card" style="margin-bottom:24px">
          <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px">
            <div class="form-group" style="margin:0;min-width:240px">
              <label>Select Class / Batch</label>
              <select [(ngModel)]="selectedBatchId" (ngModelChange)="loadRoster()">
                @for (c of classes(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label>Session Date</label>
              <input type="date" [(ngModel)]="selectedDate" (ngModelChange)="loadRoster()" />
            </div>
            <div class="form-group" style="margin:0;flex:1;min-width:200px">
              <label>Topic Covered</label>
              <input type="text" [(ngModel)]="topicCovered" placeholder="e.g. Rotational Dynamics & Moment of Inertia" />
            </div>
            <button class="btn btn-secondary" (click)="markAll('PRESENT')">✓ Mark All Present</button>
            <button class="btn btn-primary" (click)="saveAttendance()">💾 Save Attendance</button>
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status (Present / Absent / Late / Excused)</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                @for (rec of roster(); track rec.studentId) {
                  <tr>
                    <td>
                      <strong>{{ rec.student?.user?.firstName }} {{ rec.student?.user?.lastName }}</strong>
                      <div style="font-size:0.75rem;color:#64748b">{{ rec.student?.studentCode }}</div>
                    </td>
                    <td>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        @for (st of ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']; track st) {
                          <button
                            type="button"
                            class="btn btn-sm"
                            [class.btn-success]="rec.status === st && st === 'PRESENT'"
                            [class.btn-danger]="rec.status === st && st === 'ABSENT'"
                            [class.btn-primary]="rec.status === st && (st === 'LATE' || st === 'EXCUSED')"
                            [class.btn-secondary]="rec.status !== st"
                            (click)="rec.status = st"
                          >
                            {{ st }}
                          </button>
                        }
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        [(ngModel)]="rec.remarks"
                        placeholder="Optional note..."
                        style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;width:100%"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (studentAtt()) {
        <!-- Student / Parent Attendance View -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Overall Attendance</div>
              <div class="kpi-value">{{ studentAtt().summary.percentage }}%</div>
              <div class="kpi-sub">Minimum required: 75%</div>
            </div>
            <div class="kpi-icon" style="background:#ecfdf5;color:#059669"><span class="material-icons-outlined">check_circle</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Present Sessions</div>
              <div class="kpi-value">{{ studentAtt().summary.present }}</div>
              <div class="kpi-sub">+ {{ studentAtt().summary.late }} Late</div>
            </div>
            <div class="kpi-icon"><span class="material-icons-outlined">event_available</span></div>
          </div>
          <div class="kpi-card">
            <div>
              <div class="kpi-label">Absent Sessions</div>
              <div class="kpi-value">{{ studentAtt().summary.absent }}</div>
              <div class="kpi-sub">{{ studentAtt().summary.excused }} Excused</div>
            </div>
            <div class="kpi-icon" style="background:#fef2f2;color:#dc2626"><span class="material-icons-outlined">event_busy</span></div>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class / Batch</th>
                <th>Subject & Topic</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              @for (r of studentAtt().records; track r.id) {
                <tr>
                  <td><strong>{{ r.attendance.dateString }}</strong></td>
                  <td>{{ r.attendance.classBatch?.name }}</td>
                  <td>{{ r.attendance.subject?.name || 'General' }} • {{ r.attendance.topicCovered || 'Session' }}</td>
                  <td>
                    <span
                      class="badge"
                      [class.badge-success]="r.status === 'PRESENT'"
                      [class.badge-danger]="r.status === 'ABSENT'"
                      [class.badge-warning]="r.status === 'LATE' || r.status === 'EXCUSED'"
                    >{{ r.status }}</span>
                  </td>
                  <td>{{ r.remarks || '-' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AttendanceManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly classes = signal<any[]>([]);
  readonly roster = signal<any[]>([]);
  readonly studentAtt = signal<any>(null);

  selectedBatchId = '';
  selectedDate = new Date().toISOString().split('T')[0];
  topicCovered = 'Conceptual Problem Solving Session';

  isStaff() {
    const r = this.auth.userRole();
    return r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'TEACHER';
  }

  ngOnInit() {
    if (this.isStaff()) {
      this.api.get('classes').subscribe((res) => {
        this.classes.set(res || []);
        if (res?.length) {
          this.selectedBatchId = res[0].id;
          this.loadRoster();
        }
      });
    } else {
      const studentId = this.auth.selectedChildId() || undefined;
      this.api.get('attendance', { studentId }).subscribe((res) => this.studentAtt.set(res));
    }
  }

  loadRoster() {
    if (!this.selectedBatchId || !this.selectedDate) return;
    this.api
      .get('attendance/session', {
        classBatchId: this.selectedBatchId,
        date: this.selectedDate,
      })
      .subscribe((res) => {
        this.topicCovered = res.topicCovered || 'Conceptual Problem Solving Session';
        this.roster.set(res.records || []);
      });
  }

  markAll(status: string) {
    this.roster.update((list) => list.map((r) => ({ ...r, status })));
  }

  saveAttendance() {
    this.api
      .post('attendance', {
        classBatchId: this.selectedBatchId,
        date: this.selectedDate,
        topicCovered: this.topicCovered,
        records: this.roster().map((r) => ({
          studentId: r.studentId,
          status: r.status,
          remarks: r.remarks,
        })),
      })
      .subscribe(() => {
        this.toast.success('Attendance Recorded', `Saved attendance for ${this.selectedDate}`);
      });
  }

  exportCsv() {
    this.api.downloadFile('reports/export/csv', 'edunexus-attendance.csv', { type: 'attendance' });
  }

  exportPdf() {
    this.api.downloadFile('pdf/attendance-report', 'Attendance-Report.pdf', {
      classBatchId: this.selectedBatchId,
    });
  }
}

// ============================================================================
// 5. STUDY MATERIALS, HOMEWORK ASSIGNMENTS & MESSAGING COMPONENTS
// ============================================================================
@Component({
  selector: 'app-study-materials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Study Materials & Digital Library</h1>
          <p class="page-subtitle">Formula handbooks, lecture notes, presentations, and reference links</p>
        </div>
        @if (isStaff()) {
          <button class="btn btn-primary" (click)="showAdd.set(!showAdd())">
            {{ showAdd() ? 'Close' : '+ Upload Study Resource' }}
          </button>
        }
      </div>

      @if (showAdd()) {
        <div class="card" style="margin-bottom:24px">
          <h3>Publish Study Material</h3>
          <form (ngSubmit)="createMaterial()">
            <div class="form-grid">
              <div class="form-group">
                <label>Title <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.title" name="title" required />
              </div>
              <div class="form-group">
                <label>Resource Type</label>
                <select [(ngModel)]="form.materialType" name="materialType">
                  <option value="PDF">PDF Document</option>
                  <option value="PRESENTATION">Presentation Slides</option>
                  <option value="LINK">External Reference Link</option>
                </select>
              </div>
              <div class="form-group">
                <label>Subject <span class="req">*</span></label>
                <select [(ngModel)]="form.subjectId" name="subjectId" required>
                  @for (s of subjects(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Target Batch</label>
                <select [(ngModel)]="form.classBatchId" name="classBatchId">
                  <option value="">All Batches</option>
                  @for (c of classes(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea rows="2" [(ngModel)]="form.description" name="description"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Publish Resource</button>
          </form>
        </div>
      }

      <div class="grid-3">
        @for (m of materials(); track m.id) {
          <div class="card card-hover">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px">
              <span class="badge badge-primary">{{ m.subject?.name }}</span>
              <span class="badge badge-info">{{ m.materialType }}</span>
            </div>
            <h3 style="margin:0 0 6px">{{ m.title }}</h3>
            <p style="font-size:0.86rem;color:#475569">{{ m.description }}</p>
            <div style="font-size:0.78rem;color:#64748b;margin-top:12px">
              Batch: {{ m.classBatch?.name || 'All Batches' }} • By {{ m.uploadedBy?.firstName }} {{ m.uploadedBy?.lastName }}
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class StudyMaterialsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly materials = signal<any[]>([]);
  readonly subjects = signal<any[]>([]);
  readonly classes = signal<any[]>([]);
  readonly showAdd = signal(false);

  form = {
    title: '',
    description: '',
    materialType: 'PDF',
    subjectId: '',
    classBatchId: '',
  };

  isStaff() {
    return ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(this.auth.userRole() || '');
  }

  ngOnInit() {
    this.loadMaterials();
    this.api.get('subjects').subscribe((res) => {
      this.subjects.set(res || []);
      if (res?.length) this.form.subjectId = res[0].id;
    });
    this.api.get('classes').subscribe((res) => this.classes.set(res || []));
  }

  loadMaterials() {
    this.api.get('materials').subscribe((res) => this.materials.set(res || []));
  }

  createMaterial() {
    if (!this.form.title || !this.form.subjectId) return;
    this.api.post('materials', this.form).subscribe(() => {
      this.toast.success('Material Published', 'Available to students.');
      this.showAdd.set(false);
      this.loadMaterials();
    });
  }
}

@Component({
  selector: 'app-assignments-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Homework & Daily Practice Problems (DPP)</h1>
          <p class="page-subtitle">Assignments, student submissions, and teacher grading feedback</p>
        </div>
        @if (isStaff()) {
          <button class="btn btn-primary" (click)="showAdd.set(!showAdd())">
            {{ showAdd() ? 'Close' : '+ Create Assignment' }}
          </button>
        }
      </div>

      @if (showAdd()) {
        <div class="card" style="margin-bottom:24px">
          <h3>Create Homework Assignment</h3>
          <form (ngSubmit)="createAssignment()">
            <div class="form-grid">
              <div class="form-group">
                <label>Title <span class="req">*</span></label>
                <input type="text" [(ngModel)]="form.title" name="title" required />
              </div>
              <div class="form-group">
                <label>Subject <span class="req">*</span></label>
                <select [(ngModel)]="form.subjectId" name="subjectId" required>
                  @for (s of subjects(); track s.id) {
                    <option [value]="s.id">{{ s.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Class / Batch</label>
                <select [(ngModel)]="form.classBatchId" name="classBatchId">
                  @for (c of classes(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Max Marks</label>
                <input type="number" [(ngModel)]="form.maxMarks" name="maxMarks" />
              </div>
            </div>
            <div class="form-group">
              <label>Instructions <span class="req">*</span></label>
              <textarea rows="3" [(ngModel)]="form.instructions" name="instructions" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Assign Homework</button>
          </form>
        </div>
      }

      @for (asg of assignments(); track asg.id) {
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <span class="badge badge-primary" style="margin-right:8px">{{ asg.subject?.name }}</span>
              <strong style="font-size:1.05rem">{{ asg.title }}</strong>
            </div>
            <span class="badge badge-info">Due: {{ asg.dueDate | date:'mediumDate' }} • Max {{ asg.maxMarks }} Marks</span>
          </div>
          <p style="font-size:0.88rem;color:#475569">{{ asg.instructions }}</p>

          @if (auth.userRole() === 'STUDENT') {
            @if (asg.submissions?.length) {
              <div style="background:#ecfdf5;padding:10px 14px;border-radius:8px;font-size:0.85rem;color:#047857">
                ✓ <strong>Submitted</strong> ({{ asg.submissions[0].status }})
                @if (asg.submissions[0].marksObtained !== null) {
                  — Marks: <strong>{{ asg.submissions[0].marksObtained }}/{{ asg.maxMarks }}</strong> | Feedback: {{ asg.submissions[0].feedback }}
                }
              </div>
            } @else {
              <div style="display:flex;gap:10px;margin-top:12px">
                <input
                  type="text"
                  [(ngModel)]="submissionTextMap[asg.id]"
                  placeholder="Enter your solution summary or link..."
                  style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px"
                />
                <button class="btn btn-primary btn-sm" (click)="submitHomework(asg.id)">Submit Assignment</button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class AssignmentsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly assignments = signal<any[]>([]);
  readonly subjects = signal<any[]>([]);
  readonly classes = signal<any[]>([]);
  readonly showAdd = signal(false);

  submissionTextMap: Record<string, string> = {};

  form = {
    title: '',
    instructions: '',
    subjectId: '',
    classBatchId: '',
    maxMarks: 25,
  };

  isStaff() {
    return ['SUPER_ADMIN', 'ADMIN', 'TEACHER'].includes(this.auth.userRole() || '');
  }

  ngOnInit() {
    this.loadAssignments();
    this.api.get('subjects').subscribe((res) => {
      this.subjects.set(res || []);
      if (res?.length) this.form.subjectId = res[0].id;
    });
    this.api.get('classes').subscribe((res) => {
      this.classes.set(res || []);
      if (res?.length) this.form.classBatchId = res[0].id;
    });
  }

  loadAssignments() {
    this.api.get('assignments').subscribe((res) => this.assignments.set(res || []));
  }

  createAssignment() {
    if (!this.form.title || !this.form.instructions) return;
    this.api.post('assignments', this.form).subscribe(() => {
      this.toast.success('Assignment Created', 'Published to batch.');
      this.showAdd.set(false);
      this.loadAssignments();
    });
  }

  submitHomework(assignmentId: string) {
    const text = this.submissionTextMap[assignmentId];
    if (!text) return;
    this.api.post(`assignments/${assignmentId}/submit`, { submissionText: text }).subscribe(() => {
      this.toast.success('Assignment Submitted', 'Your teacher has been notified.');
      this.loadAssignments();
    });
  }
}

@Component({
  selector: 'app-messaging-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Real-Time Chat & Academic Doubt Forum</h1>
          <p class="page-subtitle">Instant live messaging between Teachers, Students, Parents, and Administration</p>
        </div>
        <div class="live-pill" [class.connected]="realtime.isConnected()">
          <span class="dot"></span>
          {{ realtime.isConnected() ? 'Live Real-Time Connected' : 'Connecting...' }}
        </div>
      </div>

      <div class="chat-layout" [class.mobile-chat-open]="mobileShowChat()">
        <!-- Conversations Sidebar -->
        <div class="card conv-list">
          <div style="margin-bottom:12px">
            <label style="font-size:0.76rem;font-weight:700;color:#64748b;display:block;margin-bottom:6px">START NEW CONVERSATION</label>
            <select [(ngModel)]="newRecipientId" (ngModelChange)="startNewChat($event)" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:0.88rem">
              <option value="">+ Select Authorized Contact...</option>
              @for (c of contacts(); track c.id) {
                <option [value]="c.id">{{ c.firstName }} {{ c.lastName }} ({{ c.role }})</option>
              }
            </select>
          </div>

          <div class="conv-scroll">
            @for (conv of conversations(); track conv.id) {
              <div
                class="conv-item"
                [class.active]="activeConv()?.id === conv.id"
                (click)="openConversation(conv.id)"
              >
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <strong style="font-size:0.9rem;color:#0f172a">
                    {{ conv.otherParticipants?.[0]?.firstName }} {{ conv.otherParticipants?.[0]?.lastName }}
                  </strong>
                  @if (conv.unreadCount > 0) {
                    <span class="badge badge-primary">{{ conv.unreadCount }}</span>
                  }
                </div>
                <div style="font-size:0.75rem;color:#4f46e5;font-weight:600;margin-top:2px">
                  {{ conv.otherParticipants?.[0]?.role }} • {{ conv.subject }}
                </div>
                <div style="font-size:0.8rem;color:#64748b;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  {{ conv.lastMessage?.content || 'No messages yet' }}
                </div>
              </div>
            } @empty {
              <div style="padding:24px 12px;text-align:center;color:#64748b;font-size:0.85rem">
                No conversations yet. Choose a contact above to start chatting in real time!
              </div>
            }
          </div>
        </div>

        <!-- Chat Window -->
        <div class="card chat-window">
          @if (activeConv()) {
            <div class="chat-header">
              <div style="display:flex;align-items:center;gap:10px">
                <button type="button" class="btn btn-secondary btn-sm mobile-back-btn" (click)="mobileShowChat.set(false)">
                  ← Chats
                </button>
                <div>
                  <strong style="font-size:0.98rem;display:block">
                    {{ getOtherParticipantName(activeConv()) }}
                  </strong>
                  <span style="font-size:0.75rem;color:#64748b">{{ activeConv().subject }}</span>
                </div>
              </div>
              @if (typingUser()) {
                <span class="typing-indicator">✍️ {{ typingUser() }} is typing...</span>
              }
            </div>

            <div class="chat-messages" id="chatMessagesContainer">
              @for (m of activeConv().messages; track m.id) {
                <div class="msg-bubble" [class.mine]="m.senderId === auth.currentUser()?.id">
                  <div class="msg-sender">{{ m.sender?.firstName }} {{ m.sender?.lastName }} ({{ m.sender?.role }})</div>
                  <div class="msg-text">{{ m.content }}</div>
                  <div class="msg-time">{{ m.createdAt | date:'shortTime' }}</div>
                </div>
              }
            </div>

            <form class="chat-input-bar" (ngSubmit)="sendReply()">
              <input
                type="text"
                [(ngModel)]="replyText"
                (ngModelChange)="onTypingInput()"
                name="replyText"
                placeholder="Type a message and press Enter..."
                autocomplete="off"
                required
              />
              <button type="submit" class="btn btn-primary" [disabled]="sending()">
                <span class="material-icons-outlined" style="font-size:18px">send</span>
                <span class="send-label">Send</span>
              </button>
            </form>
          } @else {
            <div class="empty-state" style="margin:auto">
              <span class="material-icons-outlined">forum</span>
              <h4>Select a conversation or start a new chat</h4>
              <p>Messages are delivered instantly in real time with sound & push alerts.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .live-pill {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px;
      border-radius: 999px; font-size: 0.78rem; font-weight: 700;
      background: #fef3c7; color: #92400e;
      .dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; }
      &.connected { background: #ecfdf5; color: #047857; .dot { background: #10b981; box-shadow: 0 0 8px #10b981; } }
    }
    .chat-layout { display: grid; grid-template-columns: 330px 1fr; gap: 20px; height: calc(100vh - 200px); min-height: 480px; }
    .conv-list { display: flex; flex-direction: column; overflow: hidden; height: 100%; }
    .conv-scroll { flex: 1; overflow-y: auto; padding-right: 4px; }
    .conv-item {
      padding: 12px; border-radius: 10px; border: 1px solid #f1f5f9; margin-bottom: 8px; cursor: pointer; transition: all 0.15s;
      &:hover { background: #f8fafc; }
      &.active { background: #eef2ff; border-color: #c7d2fe; }
    }
    .chat-window { display: flex; flex-direction: column; justify-content: space-between; height: 100%; overflow: hidden; }
    .chat-header {
      padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .mobile-back-btn { display: none; }
    .typing-indicator { font-size: 0.78rem; color: #4f46e5; font-weight: 600; animation: pulse 1.2s infinite; }
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 4px; display: flex; flex-direction: column; gap: 10px;
    }
    .msg-bubble {
      max-width: 78%; padding: 10px 14px; border-radius: 14px; background: #f1f5f9; align-self: flex-start;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      &.mine {
        background: #4f46e5; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px;
        .msg-sender, .msg-time { color: #c7d2fe; }
      }
      .msg-sender { font-size: 0.7rem; font-weight: 700; color: #475569; margin-bottom: 3px; }
      .msg-text { font-size: 0.9rem; line-height: 1.45; word-break: break-word; }
      .msg-time { font-size: 0.68rem; color: #94a3b8; margin-top: 4px; text-align: right; }
    }
    .chat-input-bar {
      display: flex; gap: 10px; padding-top: 12px; border-top: 1px solid #e2e8f0;
      input { flex: 1; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.92rem; min-width: 0; }
    }
    @media (max-width: 900px) {
      .chat-layout { grid-template-columns: 1fr; height: calc(100vh - 170px); min-height: 420px; }
      .mobile-back-btn { display: inline-flex; }
      .chat-layout:not(.mobile-chat-open) .chat-window { display: none; }
      .chat-layout.mobile-chat-open .conv-list { display: none; }
      .msg-bubble { max-width: 88%; }
      .send-label { display: none; }
    }
  `],
})
export class MessagingPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly realtime = inject(RealtimeService);

  readonly conversations = signal<any[]>([]);
  readonly contacts = signal<any[]>([]);
  readonly activeConv = signal<any>(null);
  readonly mobileShowChat = signal<boolean>(false);
  readonly typingUser = signal<string>('');
  readonly sending = signal<boolean>(false);

  newRecipientId = '';
  replyText = '';
  private subs: Subscription[] = [];
  private typingTimeout: any;
  private lastTypedSent = 0;

  ngOnInit() {
    this.realtime.connect();
    this.loadConversations(true);
    this.api.get('messages/contacts').subscribe((res) => this.contacts.set(res || []));

    // Subscribe to real-time incoming messages
    this.subs.push(
      this.realtime.incomingMessage$.subscribe(({ conversationId, message }) => {
        const current = this.activeConv();
        if (current && current.id === conversationId) {
          const exists = (current.messages || []).some((m: any) => m.id === message.id);
          if (!exists) {
            this.activeConv.set({
              ...current,
              messages: [...(current.messages || []), message],
            });
            this.scrollToBottom();
          }
        }
        this.loadConversations(false);
      }),
    );

    // Subscribe to real-time typing events
    this.subs.push(
      this.realtime.typingStatus$.subscribe((payload) => {
        if (this.activeConv()?.id === payload.conversationId && payload.isTyping) {
          this.typingUser.set(payload.userName);
          clearTimeout(this.typingTimeout);
          this.typingTimeout = setTimeout(() => this.typingUser.set(''), 3000);
        } else if (this.activeConv()?.id === payload.conversationId && !payload.isTyping) {
          this.typingUser.set('');
        }
      }),
    );
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
    clearTimeout(this.typingTimeout);
  }

  getOtherParticipantName(conv: any): string {
    if (!conv?.participants) return conv?.subject || 'Conversation';
    const other = conv.participants
      .map((p: any) => p.user)
      .find((u: any) => u && u.id !== this.auth.currentUser()?.id);
    return other ? `${other.firstName} ${other.lastName} (${other.role})` : conv.subject;
  }

  loadConversations(openFirst = false) {
    this.api.get('messages').subscribe((res) => {
      this.conversations.set(res || []);
      if (openFirst && res?.length && !this.activeConv()) {
        this.openConversation(res[0].id, false);
      }
    });
  }

  openConversation(id: string, switchMobileView = true) {
    this.api.get(`messages/${id}`).subscribe((res) => {
      this.activeConv.set(res);
      if (switchMobileView) {
        this.mobileShowChat.set(true);
      }
      this.scrollToBottom();
      // Refresh unread badges in sidebar
      this.api.get('messages').subscribe((list) => this.conversations.set(list || []));
    });
  }

  startNewChat(recipientUserId: string) {
    if (!recipientUserId) return;
    this.api
      .post('messages', {
        recipientUserId,
        content: 'Hello! I would like to connect regarding classes and assessments.',
      })
      .subscribe((msg) => {
        this.newRecipientId = '';
        this.loadConversations(false);
        this.openConversation(msg.conversationId, true);
      });
  }

  onTypingInput() {
    const convId = this.activeConv()?.id;
    if (!convId) return;
    const now = Date.now();
    if (now - this.lastTypedSent > 2000) {
      this.lastTypedSent = now;
      this.api.post('messages/typing', { conversationId: convId, isTyping: true }).subscribe({ error: () => {} });
    }
  }

  sendReply() {
    const text = this.replyText.trim();
    const current = this.activeConv();
    if (!text || !current || this.sending()) return;

    this.sending.set(true);
    this.replyText = '';

    this.api
      .post('messages', {
        conversationId: current.id,
        content: text,
      })
      .subscribe({
        next: (savedMsg) => {
          this.sending.set(false);
          const latest = this.activeConv();
          if (latest && latest.id === current.id) {
            const exists = (latest.messages || []).some((m: any) => m.id === savedMsg.id);
            if (!exists) {
              this.activeConv.set({
                ...latest,
                messages: [...(latest.messages || []), savedMsg],
              });
            }
          }
          this.scrollToBottom();
          this.loadConversations(false);
        },
        error: () => {
          this.sending.set(false);
          this.replyText = text;
        },
      });
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = document.getElementById('chatMessagesContainer');
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 60);
  }
}
