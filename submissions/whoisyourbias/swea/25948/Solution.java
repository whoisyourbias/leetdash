import java.util.*;

class UserSolution {
    private final static int MAX_N = 100;
    class RESULT {
    	int[][] heights;
    	RESULT() {
    		heights = new int[MAX_N][MAX_N];
    	}
    }
    
    int N;
    int M;
    int[][] mIceBlock;
    int[][] mIceGroup;
    static final int[] ROWS = {-1, 0, 1, 0};
    static final int[] COLS = {0, 1, 0, -1};
    
    class BFSStatus extends Pos {
        BFSStatus(int r, int c) {super(r, c);}
    }
    
    class Pos {
    	int r;
        int c;
        Pos(int r, int c) {this.r=r;this.c=c;}

		@Override
		public String toString() {
			return "[" +r+","+c + "]";
		}
    }

	class IceBlock extends Pos {
		int h;
		IceBlock(int r, int c, int h) {
			super(r, c);
			this.h = h;
		}
		@Override
		public String toString() {
			// TODO Auto-generated method stub
			return super.toString() + h;
		}
	}
    
    // 공간? 100 * 100 * 5000 = 50,000,000 byte -> 50mb
    // @TODO change into normalized pos
    class IceGroup {
    	int dir;
        ArrayDeque<IceBlock> blocks;
        int[][] map;
        int minR;
		int maxR;
		int minC;
		int maxC;
		int volume;
		int size;
		int originMinR;
		int originMinC;

		IceGroup() {
        	this.blocks = new ArrayDeque<>();
        }
        
        void init() {
            this.map = new int[N][N];
			this.volume = 0;
            for (IceBlock b : blocks) {
				this.map[b.r][b.c] = b.h;
				this.volume += b.h;
			}
			this.size = blocks.size();

			ArrayList<IceBlock> lst = new ArrayList<>(blocks);
			Collections.sort(lst, (a, b) -> {
				return a.r - b.r;
			});
            this.minR = lst.get(0).r;
			this.maxR = lst.get(lst.size() -1).r;

			Collections.sort(lst, (a, b) -> {
				return a.c - b.c;
			});
			this.minC = lst.get(0).c;
			this.maxC = lst.get(lst.size() - 1).c;
			this.originMinC = this.minC;
			this.originMinR = this.minR;
        }

		@Override
		public String toString() {
			StringBuffer bf = new StringBuffer();
			bf.append("--------------\n");
			bf.append("minR: " + minR + "\n");
			bf.append("maxR: " + maxR + "\n");
			bf.append("minC: " + minC + "\n");
			bf.append("maxC: " + maxC + "\n");
			bf.append("volume: " + volume + "\n");

			for (int i = 0 ; i < map.length; i++) {
				bf.append(Arrays.toString(map[i]) + "\n");
			}

			switch (dir) {
				case 0:
					bf.append("dir: up\n");
					break;
				case 1:
					bf.append("dir: right\n");
					break;
				case 2:
					bf.append("dir: down\n");
					break;
				default:
					bf.append("dir: left\n");
					break;
			}

			bf.append("--------------\n");
			return bf.toString();
		}
    }

	ArrayDeque<BFSStatus> q;
	ArrayDeque<IceGroup> igq;
    
    void init(int N, int M, int mIceBlock[][], int mIceGroup[][]) {
		this.N = N;
        this.M = M;
        this.mIceBlock = mIceBlock;
        this.mIceGroup = mIceGroup;
        
        this.q = new ArrayDeque<>();
        this.igq = new ArrayDeque<>();
        
        				// r
        HashMap<Integer,      // c  ,   dir
        			HashMap<Integer, Integer>> groupDirection = new HashMap<>();
        // init group dir
        for (int i = 0; i < mIceGroup.length; i++) {
        	int c = mIceGroup[i][0];
            int r = mIceGroup[i][1];
            int dir = mIceGroup[i][2];
            groupDirection.putIfAbsent(r, new HashMap<>());
            groupDirection.get(r).putIfAbsent(c, dir);
        }
        
        
        // init bfs
        boolean[][] visited = new boolean[N][N];
        for (int i = 0 ; i < N; i++) {
        	for (int j = 0 ; j < N; j++) {
                if (visited[i][j])
                    continue;
                if (mIceBlock[i][j] == 0)
					continue;

                // add one.
                q.add(new BFSStatus(i, j));
                IceGroup ig = new IceGroup();
                
				//bfs
				while (!q.isEmpty()) {
                	BFSStatus b = q.poll();
                    
                    if (visited[b.r][b.c])
                        continue;
                    visited[b.r][b.c] = true;
                    ig.blocks.add(new IceBlock(b.r, b.c, mIceBlock[b.r][b.c]));
                    
					int dir = -1;
					if (groupDirection.get(b.r) != null &&
							groupDirection.get(b.r).get(b.c) != null) {
								dir = groupDirection.get(b.r).get(b.c);
							}
					if (dir != -1)
						ig.dir = dir;
                    for (int k = 0 ; k < 4; k++) {
                    	int nextr = b.r + ROWS[k];
                        int nextc = b.c + COLS[k];
						if (nextr < 0)
							nextr = N - 1;
						if (nextr == N)
							nextr = 0;
						if (nextc < 0)
							nextc = N - 1;
						if (nextc == N)
							nextc = 0;
                        
                        if (visited[nextr][nextc])
                            continue;
                        
                        if (mIceBlock[nextr][nextc] != 0) {
                        	q.add(new BFSStatus(nextr, nextc));
                        }
                    }
                }
                
                // 후처리
            	ig.init();
				this.igq.add(ig);
            }
        }
    }

    RESULT oneYearLater() {
    	RESULT res = new RESULT();


		ArrayDeque<IceGroup> newIgq = new ArrayDeque<>();

		// rule a 융해
		while (!this.igq.isEmpty()) {
			IceGroup ig = this.igq.poll();
			RuleA(ig, newIgq);
		}
		// rule b 이동
		for (IceGroup ig: newIgq)
			RuleB(ig);
		// rule c 병합

		this.igq = RuleC(newIgq);

		// 합치기
		for (IceGroup ig: this.igq) {
			for (int i = ig.minR; i <= ig.maxR; i++) {
				for (int j = ig.minC; j <= ig.maxC; j++) {
					if (ig.map[i][j] != 0)
						res.heights[i][j] = ig.map[i][j];
				}
			}
		}

    	return res;
    }


	// a.융해
	//  1.- 빙하를 구성하고 있는 얼음덩어리 중 바다와 인접한 얼음덩어리들의 높이가 1 씩 줄어든다.
	//  2.높이가 0 이 될 경우 그 얼음덩어리는 사라진다.
	//  3.융해에 의해 빙하는 2 개 이상의 빙하로 나누어 질 수 있다.
	//  4.빙하가 나누어지더라도 각 빙하의 이동 방향은 변하지 않는다.
	private void RuleA(IceGroup ig, ArrayDeque<IceGroup> newIgq) {
		
		// a.1
		int[][] nmap = new int[N][N];
		for (int i = 0; i <N; i++)
			nmap[i] = ig.map[i].clone();

		for (int i = ig.minR; i <= ig.maxR; i++) {
			for (int j = ig.minC; j <= ig.maxC; j++) {
				// 바다와 인접한 경우 
				for (int k = 0; k < 4; k++) {
				
					int nextr = i + ROWS[k];
					int nextc = j + COLS[k];
					if (nextr < 0)
						nextr = N - 1;
					if (nextr == N)
						nextr = 0;
					if (nextc < 0)
						nextc = N - 1;
					if (nextc == N)
						nextc = 0;
					// a.2
					if (ig.map[nextr][nextc] == 0) {
						nmap[i][j] = Math.max(0, ig.map[i][j] -1);
						break;
					}
				}
			}
		}

        // init bfs
		// a.3
        boolean[][] visited = new boolean[N][N];
		for (int i = ig.minR; i <= ig.maxR; i++) {
			for (int j = ig.minC; j <= ig.maxC; j++) {
                if (visited[i][j])
                    continue;
                if (nmap[i][j] == 0)
					continue;

                // add one.
                q.add(new BFSStatus(i, j));
                IceGroup newIg = new IceGroup();
                newIg.map = nmap;
				
				//bfs
				while (!q.isEmpty()) {
                	BFSStatus b = q.poll();
                    
                    if (visited[b.r][b.c])
                        continue;
                    visited[b.r][b.c] = true;
                    newIg.blocks.add(new IceBlock(b.r, b.c, nmap[b.r][b.c]));
                   
					// 이동방향 기존 유지
					// a.4
					newIg.dir = ig.dir;
                    for (int k = 0 ; k < 4; k++) {
                    	int nextr = b.r + ROWS[k];
                        int nextc = b.c + COLS[k];
						if (nextr < 0)
							nextr = N - 1;
						if (nextr == N)
							nextr = 0;
						if (nextc < 0)
							nextc = N - 1;
						if (nextc == N)
							nextc = 0;
                        if (visited[nextr][nextc])
                            continue;
                        
                        if (nmap[nextr][nextc] != 0) {
                        	q.add(new BFSStatus(nextr, nextc));
                        }
                    }
                }
                
                // 후처리
            	newIg.init();
				newIgq.add(newIg);
            }
        }

	}

	// 빙하는 매년 1 칸씩 인접 좌표로 이동한다.
	// 모든 빙하는 동시에 이동을 한다.
	private void RuleB(IceGroup ig) {
		int dir = ig.dir;
		int[][] nmap = new int[N][N];
		int newMinR = Integer.MAX_VALUE;
		int newMaxR = Integer.MIN_VALUE;
		int newMinC = Integer.MAX_VALUE;
		int newMaxC = Integer.MIN_VALUE;
		for (int i = ig.minR; i <= ig.maxR; i++) {
			for (int j = ig.minC; j <= ig.maxC; j++) {
				if (ig.map[i][j] == 0)
					continue;

				int nextr = i + ROWS[dir];
				int nextc = j + COLS[dir];

				if (nextr < 0) {
					nextr = N - 1;
				} else if (nextr == N) {
					nextr = 0;
				}
				if (nextc < 0) {
					nextc = N - 1;
				} else if (nextc == N) {
					nextc = 0;
				}

				if (ig.map[i][j] != 0) {
					newMinR = Math.min(newMinR, nextr);
					newMinC = Math.min(newMinC, nextc);
					newMaxR = Math.max(newMaxR, nextr);
					newMaxC = Math.max(newMaxC, nextc);
				}
				nmap[nextr][nextc] = ig.map[i][j];
			}
		}
		ig.map = nmap;
		ig.minR = newMinR;
		ig.maxR = newMaxR;
		ig.minC = newMinC;
		ig.maxC = newMaxC;
	}

	class CollisionSet {
		ArrayDeque<IceGroup> arr;
		CollisionSet() {this.arr = new ArrayDeque<>();}
	}

	// Rule c
	// 이동 후 서로 다른 빙하를 구성하고 있는 얼음덩어리가 같은 좌표에 겹치거나 상하좌우로 인접할 수 있다.
	// 겹칠 경우 두 얼음덩어리 중 높이가 높은 얼음덩어리만 그 좌표에 남는다.
	// 병합 된 빙하는 이동 방향이 바뀌며, 다음과 같이 각 빙하가 이동하기 전의 상태를 비교하여 병합 후의 이동방향을 결정한다.
	// 1. 부피가 큰 빙하의 이동방향을 따른다.
	// 2. 부피가 같을 경우 면적이 작은 빙하의 이동방향을 따른다.
	// 3. 면적이 같을 경우, 두 빙하의 위치 중 Y 좌표가 작은 위치에 있는 빙하의 이동방향을 따른다.
	// 4. Y 좌표가 같을 경우, 두 빙하의 위치 중 X 좌표가 작은 위치에 있는 빙하의 이동방향을 따른다.
	private ArrayDeque<IceGroup> RuleC(ArrayDeque<IceGroup> newIgq) {
		CollisionSet[][] collisionMap = new CollisionSet[N][N];

		ArrayDeque<IceGroup> rtn = new ArrayDeque<>();
		while (!newIgq.isEmpty()) {
			IceGroup checking = newIgq.poll();

			// 충돌체크
			for (int i = checking.minR; i <= checking.maxR; i++) {
				for (int j = checking.minC; j <= checking.maxC; j++) {
					q.add(new BFSStatus(i, j));
				}
			}


			/*
			 * bfs로 checking의 좌표 모두 체크.
			 * 만약 겹치는 좌표가 없다면 그냥 넣기.
			 * 겹치는 좌표는 2가지 종류가 있음.
			 * collision - 충돌병합
			 * touch - 그냥 닿는 병합
			 * 
			 * */
			boolean[][] visited = new boolean[N][N];
			while (!q.isEmpty()) {
				BFSStatus b = q.poll();

				if (visited[b.r][b.c])
					continue;
				visited[b.r][b.c] = true;

				if (checking.map[b.r][b.c] != 0) {
					if (collisionMap[b.r][b.c] == null)
						collisionMap[b.r][b.c] = new CollisionSet();
					collisionMap[b.r][b.c].arr.add(checking);
				}
				for (int k = 0; k < 4;k++) {
					int nextr = b.r + ROWS[k];
					int nextc = b.c + COLS[k];

					if (nextr < 0) {
						nextr = N - 1;
					} else if (nextr == N) {
						nextr = 0;
					}
					if (nextc < 0) {
						nextc = N - 1;
					} else if (nextc == N) {
						nextc = 0;
					}

					if (visited[nextr][nextc])
						continue;

					if (checking.map[nextr][nextc] == 0)
						continue;

					q.add(new BFSStatus(nextr, nextc));
				}
			}
		}

		// init
		boolean[][] visited = new boolean[N][N];
		for (int i = 0; i < N; i++) {
			for (int j = 0; j < N; j++) {
				if (!visited[i][j] && collisionMap[i][j] != null) {
					q.add(new BFSStatus(i, j));
				} else {
					continue;
				}

				IceGroup combined = new IceGroup();
				IceGroup currentPriotized = collisionMap[q.peek().r][q.peek().c].arr.getFirst();
				while (!q.isEmpty()) {
					BFSStatus b = q.poll();


					if (visited[b.r][b.c])
						continue;
					visited[b.r][b.c] = true;

					// 우선순위화된 DIR 가져오기
					PriorityQueue<IceGroup> pq = new PriorityQueue<>((IceGroup i1, IceGroup i2) -> {
						// 2. 부피가 같을 경우 
						if (i1.volume == i2.volume) {
							// 3. 면적이 같을 경우, 
							if (i1.size == i2.size) {
								// 두 빙하의 위치 중 Y 좌표가 작은 위치에 있는 빙하의 이동방향을 따른다.
								if (i1.originMinR == i2.originMinR) {
								// 4. Y 좌표가 같을 경우, 
								// 두 빙하의 위치 중 X 좌표가 작은 위치에 있는 빙하의 이동방향을 따른다.
									return i1.originMinC - i2.originMinC;
								} else {
									return i1.originMinR - i2.originMinR;
								}
							} else {
								// 면적이 작은 빙하의 이동방향을 따른다.
								return i1.size - i2.size;
							}
						} else {
							// 1. 부피가 큰 빙하의 이동방향을 따른다.
							return i2.volume - i1.volume;
						}
					});

					int h = 0;
					for (IceGroup g : collisionMap[b.r][b.c].arr) {
						h = Math.max(h, g.map[b.r][b.c]);
						pq.add(g);
					}

					if (currentPriotized != collisionMap[b.r][b.c].arr.getFirst()) {
						pq.add(currentPriotized);
					}

					currentPriotized = pq.peek();
					
                    combined.blocks.add(new IceBlock(b.r, b.c, h));
                    
					for (int k = 0 ; k < 4; k++) {
                    	int nextr = b.r + ROWS[k];
                        int nextc = b.c + COLS[k];
						if (nextr < 0)
							nextr = N - 1;
						if (nextr == N)
							nextr = 0;
						if (nextc < 0)
							nextc = N - 1;
						if (nextc == N)
							nextc = 0;
                        if (visited[nextr][nextc])
                            continue;
                        if (collisionMap[nextr][nextc] != null) {
                        	q.add(new BFSStatus(nextr, nextc));
                        }
                    }
				}

				combined.dir = currentPriotized.dir;
				combined.init();
				rtn.add(combined);
			}
		}
		return rtn;
	}
}
