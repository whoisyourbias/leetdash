import java.util.LinkedList;

class Solution {
	static int ways = 0;

	private class Status {
		int remainStairs;

		Status(int remainStairs) {
			this.remainStairs = remainStairs;
		}

		Status(Status other) {
			this.remainStairs = other.remainStairs;

		}
	}

	public int climbStairs(int n) {
		LinkedList<Status> queue = new LinkedList<>();

		Status init = new Status(n);
		queue.add(init);
		while (queue.size() != 0) {
			Status polled = queue.poll();
			bfs(queue, polled);
		}

		return Solution.ways;
	}

	private void bfs(LinkedList<Status> queue, Status s) {
		// END STATEMENT
		if (s.remainStairs == 0) {
			Solution.ways++;
			return;
		}

		if (s.remainStairs >= 2) {
			Status v1 = new Status(s);
			// 2 or 1
			v1.remainStairs -= 2;
			queue.add(v1);

			s.remainStairs -= 1;
			queue.add(s);

		}
		if (s.remainStairs == 1) {
			s.remainStairs -= 1;
			queue.add(s);
		}
	}
}
