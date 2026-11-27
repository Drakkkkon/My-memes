package kz.drakkkkon.moememy;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** Фоновая проверка новых мемов и новой версии по расписанию Android. */
public class CheckJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            Notify.check(getApplicationContext(), false);
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
