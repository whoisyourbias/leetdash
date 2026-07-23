import java.util.Stack;

class MinStack {
	private Stack<Integer> stack;
	private Stack<Integer> minStack;

	public MinStack() {
		stack = new Stack<>();
		minStack = new Stack<>();
	}

	public void push(int val) {
		// 일반 stack에는 항상 push
		stack.push(val);
		// 최소값 유지하는 스택이 비어있으면 push
		if (minStack.isEmpty()) {
			minStack.push(val);
		} else {
			// 만약 새로 들어오는 값이 minstack의 가장 작은값보다 작을때만 푸시(minstack에는 항상 들어온 순서대로의 수 중 내림차순인
			// 
			// 숫자들만 넣어)
			if (val <= minStack.peek()) {
				minStack.push(val);
			}
		}
	}

	public void pop() {
		// 없애야하는 값이 현재 minstack값이면 삭제
		if (stack.peek() == minStack.peek()) {
			minStack.pop();
		}
		stack.pop();
	}

	public int top() {
		return stack.peek();
	}

	public int getMin() {
		return minStack.peek();
	}
}
/**
 * Your MinStack object will be instantiated and called as such:
 * MinStack obj = new MinStack();
 * obj.push(value);
 * obj.pop();
 * int param_3 = obj.top();
 * int param_4 = obj.getMin();
 */
