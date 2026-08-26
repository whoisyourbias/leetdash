import java.util.*;	
class UserSolution {
		HashMap<Integer, Integer> mIdToRowId;
		BitSet[] canFit;
		int N;
		int M;
		Row[] table;

		class Interval {
			Integer inclusiveFrom;
			Integer exclusiveTo;

			Interval(int from, int to) {
				this.inclusiveFrom = from;
				this.exclusiveTo = to;
			}

			int getLen() {
				return this.exclusiveTo - this.inclusiveFrom;
			}

			@Override
			public boolean equals(Object obj) {
				return super.equals(obj);
			}

			@Override
			public int hashCode() {
				return this.inclusiveFrom * 1000 + this.exclusiveTo;
			}
		}

		class Row {
			int rowID;
			TreeMap<Interval, Integer> emptyByFrom;
			TreeMap<Interval, Integer> emptyBySize;
			HashMap<Integer, Interval> mIdToInterval;

			Row(Interval v, int rowID) {
				this.rowID = rowID;
				this.emptyByFrom = new TreeMap<>(
						(Interval a, Interval b) -> {
							return a.inclusiveFrom - b.inclusiveFrom;
						});
				this.emptyByFrom.put(v, 1);
				this.emptyBySize = new TreeMap<>(
						(Interval a, Interval b) -> {
							if (a.getLen() == b.getLen())
								return a.inclusiveFrom - b.inclusiveFrom;
							return a.getLen() - b.getLen();
						});
				this.emptyBySize.put(v, 1);
				this.mIdToInterval = new HashMap<>();
			}

			int getMaxEmpty() {
				if (this.emptyBySize.isEmpty()) {
					return 0;
				}

				return this.emptyBySize.lastKey().getLen();
			}

			boolean write(int mId, int mLen, BitSet[] canFit) {
				// 넣기 전 이 행에 넣을 수 있는 최대길이 단어.
				Integer oldMax = getMaxEmpty();

				if (oldMax < mLen) {
					return false;
				}
				// mLen과 같거나 큰 애들 중에서 제일 작은 키
				Interval k = null;

				for (Interval I : this.emptyByFrom.keySet()) {
					if (I.getLen() >= mLen) {
						k = I;
						break;
					}
				}

				if (k == null) {
					return false;
				}

				this.emptyByFrom.remove(k);
				this.emptyBySize.remove(k);

				// 남는거 다시 넣기
				if (k.getLen() > mLen) {
					Interval newInterval = new Interval(
							k.inclusiveFrom + mLen,
							k.exclusiveTo);
					this.emptyByFrom.put(newInterval, 1);
					this.emptyBySize.put(newInterval, 1);
				}

				Interval using = new Interval(k.inclusiveFrom, k.inclusiveFrom + mLen);
				this.mIdToInterval.put(mId, using);

				// 넣은 후 이 행에 넣을 수 있는 최대길이 단어
				Integer newMax = getMaxEmpty();

				// newMax + 1 길이부터 oldMax 길이까지는 이제 넣을 수 없음.
				for (Integer v = newMax + 1; v <= oldMax; v++) {
					canFit[v].clear(this.rowID);
				}

				return true;
			}

			boolean erase(int mId, BitSet[] canFit) {
				// 지우기 전 이 행에 넣을 수 있는 최대길이 단어.
				Integer oldMax = getMaxEmpty();

				Interval using = this.mIdToInterval.get(mId);
				if (using == null) {
					return false;
				}

				Integer from = using.inclusiveFrom;
				Integer to = using.exclusiveTo;

				// 찾아서 연결해줘야함.
				Interval left = this.emptyByFrom.floorKey(using);
				Interval right = this.emptyByFrom.ceilingKey(using);

				if (left != null && left.exclusiveTo.equals(from)) {
					from = left.inclusiveFrom;
					this.emptyByFrom.remove(left);
					this.emptyBySize.remove(left);
				}

				if (right != null && right.inclusiveFrom.equals(to)) {
					to = right.exclusiveTo;
					this.emptyByFrom.remove(right);
					this.emptyBySize.remove(right);
				}

				Interval merged = new Interval(from, to);
				emptyByFrom.put(merged, 1);
				emptyBySize.put(merged, 1);

				this.mIdToInterval.remove(mId);
				// 삭제 후 이 행에 넣을 수 있는 최대길이 단어
				Integer newMax = getMaxEmpty();

				for (int len = oldMax + 1; len <= newMax; len++) {

					/*
					 * set(row)
					 *
					 * row번째 bit를 1로 만든다.
					 *
					 * 즉:
					 *
					 * "이 행에는 길이 len짜리 단어를 넣을 수 있다."
					 */
					canFit[len].set(this.rowID);
				}
				return true;
			}
		}

		/*
		 * @Param: N = # of rows, Maximum 20000
		 * 
		 * @Param: M = # of cols, Maximum 1000
		 */
		public void init(int N, int M) {
			this.N = N;
			this.M = M;
			table = new Row[N];
			for (int i = 0; i < N; i++) {
				table[i] = new Row(new Interval(0, M), i);
			}
			this.mIdToRowId = new HashMap<>();

			//
			this.canFit = new BitSet[M + 1];
			for (int i = 1; i <= M; i++) {
				// 길이가 i인 단어를 넣을 수 있는 행을 관리.
				canFit[i] = new BitSet(N);
				// 초기상태는 모두 담을 수 있음.
				canFit[i].set(0, N);
			}
		}

		/*
		 * Maximum calls : 50000
		 * 규칙3. 단어를 적을 수 있는 위치가 여러 곳이라면 우선 순위가 제일 높은 위치에 적어야 한다.
		 * 행의 번호가 작을수록, 한 행에 적을 위치가 여러 곳이라면 열의 번호가 작을수록 우선순위가 높다.
		 */
		public int writeWord(int mId, int mLen) {

			// 길이가 mLen 인 단어를 담을 수 있는 행을 index 0부터 확인.
			int row = canFit[mLen].nextSetBit(0);

			if (row == -1)
				return -1;

			if (!table[row].write(mId, mLen, this.canFit))
				return -1;
			this.mIdToRowId.put(mId, row);
			return row;
		}

		/*
		 * Maximum calls: 5000
		 */
		public int eraseWord(int mId) {
			Integer rowId = this.mIdToRowId.get(mId);
			if (rowId == null) {
				return -1;
			}

			if (!this.table[rowId].erase(mId, canFit))
				return -1;
			this.mIdToRowId.remove(mId);
			return rowId;
		}
	}
