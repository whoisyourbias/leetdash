import java.util.*;

class UserSolution {

    class FishCase {
        int mID;
        int[] length;
        int[] upShape;

        // down/up shape 3개 조합 = 4^3 = 64개
        HashSet<Integer>[] codeToIdx;

        @SuppressWarnings("unchecked")
        FishCase(int mID, int mWidth, int[] length, int[] upShape) {
            this.mID = mID;
            this.length = Arrays.copyOf(length, mWidth);
            this.upShape = Arrays.copyOf(upShape, mWidth);

            codeToIdx = new HashSet[64];

            for (int i = 0; i < 64; i++) {
                codeToIdx[i] = new HashSet<>();
            }

            // 현재 어항의 연속 3칸 upShape를 인덱싱
            for (int i = 0; i < mWidth - 2; i++) {
                codeToIdx[getCode(this, i)].add(i);
            }
        }
    }

    class PourInfo {
        int mID;
        int usedWater;
        int height;

        PourInfo(int mID, int usedWater, int height) {
            this.mID = mID;
            this.usedWater = usedWater;
            this.height = height;
        }
    }

    ArrayList<FishCase> cases;

    int mWidth;
    int mHeight;

    public void init(
            int N,
            int mWidth,
            int mHeight,
            int mIDs[],
            int mLengths[][],
            int mUpShapes[][]
    ) {
        this.mWidth = mWidth;
        this.mHeight = mHeight;

        cases = new ArrayList<>();

        for (int i = 0; i < N; i++) {
            cases.add(
                new FishCase(
                    mIDs[i],
                    mWidth,
                    mLengths[i],
                    mUpShapes[i]
                )
            );
        }

        // addStructures 우선순위:
        // ID가 작은 어항부터
        cases.sort((a, b) -> Integer.compare(a.mID, b.mID));
    }

    /*
     * 0~3의 세 값을 하나의 int로 압축
     *
     * 00 00 00
     * ~
     * 11 11 11
     *
     * 총 64개
     */
    private int getCode(int a, int b, int c) {
        return (a << 4) | (b << 2) | c;
    }

    private int getCode(FishCase f, int idx) {
        return getCode(
            f.upShape[idx],
            f.upShape[idx + 1],
            f.upShape[idx + 2]
        );
    }

    public int checkStructures(
            int mLengths[],
            int mUpShapes[],
            int mDownShapes[]
    ) {
        int count = 0;

        int code = getCode(
            mDownShapes[0],
            mDownShapes[1],
            mDownShapes[2]
        );

        for (FishCase f : cases) {

            // upShape가 맞는 후보만 검사
            for (int ci : f.codeToIdx[code]) {

                if (!checkStructureHeight(f, mLengths, ci)) {
                    continue;
                }

                if (!checkStructureLean(f, mLengths, ci)) {
                    continue;
                }

                count++;
            }
        }

        return count;
    }

    public int addStructures(
            int mLengths[],
            int mUpShapes[],
            int mDownShapes[]
    ) {
        int code = getCode(
            mDownShapes[0],
            mDownShapes[1],
            mDownShapes[2]
        );

        /*
         * cases가 이미 mID 오름차순.
         *
         * 따라서 처음으로 설치 가능한 FishCase에서
         * 가장 작은 ci를 고르면 문제의 우선순위 만족.
         */
        for (FishCase f : cases) {

            int bestIdx = Integer.MAX_VALUE;

            for (int ci : f.codeToIdx[code]) {

                if (!checkStructureHeight(f, mLengths, ci)) {
                    continue;
                }

                if (!checkStructureLean(f, mLengths, ci)) {
                    continue;
                }

                bestIdx = Math.min(bestIdx, ci);
            }

            if (bestIdx != Integer.MAX_VALUE) {

                addStructuresToFishCase(
                    f,
                    bestIdx,
                    mLengths,
                    mUpShapes
                );

                return f.mID * 1000 + bestIdx + 1;
            }
        }

        return 0;
    }

    public Solution.Result pourIn(int mWater) {

        Solution.Result ret = new Solution.Result();

        ret.ID = 0;
        ret.height = 0;
        ret.used = 0;

        PourInfo best = null;

        for (FishCase f : cases) {

            PourInfo cur = pour(f, mWater);

            if (cur == null) {
                continue;
            }

            if (best == null
                    || cur.height > best.height
                    || (cur.height == best.height
                        && cur.usedWater > best.usedWater)
                    || (cur.height == best.height
                        && cur.usedWater == best.usedWater
                        && cur.mID < best.mID)) {

                best = cur;
            }
        }

        if (best != null) {
            ret.ID = best.mID;
            ret.height = best.height;
            ret.used = best.usedWater;
        }

        return ret;
    }

    /*
     * 물을 한 칸씩 실제로 올리지 않고
     *
     * 동일한 최소 높이 그룹을
     * 다음 높이까지 한 번에 올린다.
     */
    private PourInfo pour(FishCase f, int mWater) {

        int[] heights = Arrays.copyOf(f.length, mWidth);
        Arrays.sort(heights);

        int remainWater = mWater;

        // 현재 최소 높이
        int currentHeight = heights[0];

        /*
         * currentHeight를 가진 열의 개수
         */
        int idx = 0;

        while (idx < mWidth
                && heights[idx] == currentHeight) {
            idx++;
        }

        int count = idx;

        while (currentHeight < mHeight
                && remainWater > 0) {

            int nextHeight;

            if (idx < mWidth) {
                nextHeight = heights[idx];
            } else {
                nextHeight = mHeight;
            }

            /*
             * 현재 최소 그룹 전체를
             * nextHeight까지 올리는데 필요한 물
             */
            int diff = nextHeight - currentHeight;
            int needWater = diff * count;

            /*
             * 다음 높이까지 완전히 채울 수 있음
             */
            if (needWater <= remainWater) {

                remainWater -= needWater;
                currentHeight = nextHeight;

                // 같은 높이가 된 열을 그룹에 포함
                while (idx < mWidth
                        && heights[idx] == currentHeight) {

                    idx++;
                    count++;
                }

                continue;
            }

            /*
             * nextHeight까지는 못 감.
             *
             * 현재 count개의 열을 몇 행까지
             * 완전히 채울 수 있는지 계산.
             */
            int rise = remainWater / count;

            if (rise == 0) {
                break;
            }

            currentHeight += rise;

            int used = rise * count;

            remainWater -= used;

            /*
             * 남은 물은 count개 열 전체를
             * 한 행 채울 수 없으므로 사용 불가능.
             */
            break;
        }

        int usedWater = mWater - remainWater;

        /*
         * 물을 최소 1 이상 사용해야 함
         */
        if (usedWater == 0) {
            return null;
        }

        return new PourInfo(
            f.mID,
            usedWater,
            currentHeight
        );
    }

    private void addStructuresToFishCase(
            FishCase f,
            int ci,
            int[] mLengths,
            int[] mUpShapes
    ) {
        int cj = ci + 1;
        int ck = ci + 2;

        /*
         * ci ~ ci+2가 변경되면
         * 영향을 받는 길이 3 window 시작점은
         *
         * ci-2 ~ ci+2
         *
         * 최대 5개뿐이다.
         */
        int from = Math.max(0, ci - 2);
        int to = Math.min(mWidth - 3, ci + 2);

        /*
         * 변경 전 codeToIdx 제거
         */
        for (int i = from; i <= to; i++) {
            int oldCode = getCode(f, i);

            f.codeToIdx[oldCode].remove(i);
        }

        /*
         * 실제 구조물 설치
         */
        f.length[ci] += mLengths[0];
        f.length[cj] += mLengths[1];
        f.length[ck] += mLengths[2];

        f.upShape[ci] = mUpShapes[0];
        f.upShape[cj] = mUpShapes[1];
        f.upShape[ck] = mUpShapes[2];

        /*
         * 변경 후 codeToIdx 다시 등록
         */
        for (int i = from; i <= to; i++) {
            int newCode = getCode(f, i);

            f.codeToIdx[newCode].add(i);
        }
    }

    /*
     * 어항 높이 초과 검사
     */
    private boolean checkStructureHeight(
            FishCase f,
            int[] mLengths,
            int ci
    ) {
        if (f.length[ci] + mLengths[0] > mHeight) {
            return false;
        }

        if (f.length[ci + 1] + mLengths[1] > mHeight) {
            return false;
        }

        if (f.length[ci + 2] + mLengths[2] > mHeight) {
            return false;
        }

        return true;
    }

    /*
     * 인접 구조물끼리 최소 한 셀의 면이
     * 붙어있는지 확인.
     *
     * 구간:
     *
     * [기존 높이, 기존 높이 + 새 구조물 길이)
     *
     * 두 구간의 교집합 길이가 1 이상이어야 함.
     */
    private boolean checkStructureLean(
            FishCase f,
            int[] mLengths,
            int ci
    ) {
        int cj = ci + 1;
        int ck = ci + 2;

        int aFrom = f.length[ci];
        int aTo = aFrom + mLengths[0];

        int bFrom = f.length[cj];
        int bTo = bFrom + mLengths[1];

        if (Math.max(aFrom, bFrom)
                >= Math.min(aTo, bTo)) {
            return false;
        }

        int cFrom = f.length[ck];
        int cTo = cFrom + mLengths[2];

        if (Math.max(bFrom, cFrom)
                >= Math.min(bTo, cTo)) {
            return false;
        }

        return true;
    }
}