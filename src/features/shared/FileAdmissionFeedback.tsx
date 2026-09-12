import { Button, InlineError, LargeFileWarningDialog } from "../../components";
import type { FileAdmissionState } from "./useFileAdmission";

export function FileAdmissionFeedback({ admission }: { admission: FileAdmissionState }) {
  return (
    <>
      {admission.errors.length > 0 && (
        <InlineError
          title="Một số tệp chưa được thêm"
          message={<ul className="list-disc space-y-1 break-words pl-5">
            {admission.errors.map((error, index) => <li key={index}>“{error.name}”: {error.message}</li>)}
          </ul>}
          onDismiss={admission.dismissErrors}
        />
      )}
      {admission.isReading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600" role="status">
            Đang kiểm tra tệp {Math.min(admission.progress.completed + 1, admission.progress.total)}/{admission.progress.total}…
          </p>
          <Button variant="secondary" onPress={admission.cancel}>Hủy đọc tệp</Button>
        </div>
      )}
      <LargeFileWarningDialog
        isOpen={admission.warning !== null}
        onOpenChange={(open) => { if (!open) admission.dismissWarning(); }}
        totalBytes={admission.warning?.totalBytes ?? 0}
        totalPages={admission.warning?.totalPages || undefined}
        onContinue={() => { void admission.continueReading(); }}
        onCancel={admission.cancel}
      />
    </>
  );
}
